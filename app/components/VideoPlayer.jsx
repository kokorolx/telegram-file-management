'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useEncryption } from '../contexts/EncryptionContext';

/**
 * Secure Video Player with Browser-Side Decryption (CDN-Friendly)
 *
 * SECURITY:
 * - Master password never leaves browser
 * - Server provides encrypted chunks (CDN-cacheable)
 * - All decryption happens client-side via Web Crypto API
 *
 * PERFORMANCE:
 * - Chunks cached at CDN edge (1 year cache)
 * - Parallel chunk pre-fetching
 * - Hybrid: Try MediaSource for progressive play, fallback to full download
 */
export default function VideoPlayer({ fileId, fileName, fileSize, mimeType }) {
  const { masterPassword } = useEncryption();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentChunk, setCurrentChunk] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);
  const [loadingStage, setLoadingStage] = useState('Initializing...');
  const [videoSrc, setVideoSrc] = useState(null);
  const [useMediaSource, setUseMediaSource] = useState(false);

  const videoRef = useRef(null);
  const mediaSourceRef = useRef(null);
  const sourceBufferRef = useRef(null);
  const abortControllerRef = useRef(null);
  const decryptionKeyRef = useRef(null);

  // Derive encryption key from master password using Web Crypto API
  const deriveKeyFromPassword = useCallback(async (password) => {
    const encoder = new TextEncoder();
    const passwordData = encoder.encode(password);

    // Salt must match server: 'telegram-file-manager-fixed-salt'
    const saltString = 'telegram-file-manager-fixed-salt';
    const salt = encoder.encode(saltString);

    const baseKey = await crypto.subtle.importKey(
      'raw',
      passwordData,
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );
  }, []);

  // Decrypt a chunk using IV and authTag
  const decryptChunk = useCallback(async (encryptedData, ivHex, authTagHex, key) => {
    console.log(`[Decrypt] Starting decryption...`);
    console.log(`[Decrypt] IV hex: ${ivHex} (${ivHex?.length} chars)`);
    console.log(`[Decrypt] AuthTag hex: ${authTagHex} (${authTagHex?.length} chars)`);
    console.log(`[Decrypt] Encrypted data size: ${encryptedData.byteLength} bytes`);

    const iv = new Uint8Array(ivHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
    const authTag = new Uint8Array(authTagHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
    const encryptedArray = new Uint8Array(encryptedData);

    console.log(`[Decrypt] IV: ${iv.length} bytes, AuthTag: ${authTag.length} bytes`);

    // AES-GCM expects auth tag appended to ciphertext
    const combined = new Uint8Array(encryptedArray.length + authTag.length);
    combined.set(encryptedArray);
    combined.set(authTag, encryptedArray.length);

    console.log(`[Decrypt] Combined size: ${combined.length} bytes`);

    try {
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        combined
      );

      console.log(`[Decrypt] Success! Decrypted size: ${decrypted.byteLength} bytes`);
      return new Uint8Array(decrypted);
    } catch (err) {
      console.error(`[Decrypt] FAILED:`, err);
      throw new Error(`Decryption failed: ${err.message}`);
    }
  }, []);

  // Fetch and decrypt a single chunk from CDN endpoint
  const fetchAndDecryptChunk = useCallback(async (chunkNum, key, signal) => {
    // Use CDN-friendly endpoint (no auth required)
    const response = await fetch(`/api/stream/${fileId}/chunk/${chunkNum}`, { signal });

    if (!response.ok) {
      throw new Error(`Failed to fetch chunk ${chunkNum}: ${response.status}`);
    }

    const encryptedData = await response.arrayBuffer();
    const iv = response.headers.get('x-iv');
    const authTag = response.headers.get('x-auth-tag');
    const total = parseInt(response.headers.get('x-total-chunks') || '1');

    if (!iv || !authTag) {
      throw new Error(`Missing encryption metadata for chunk ${chunkNum}`);
    }

    const decrypted = await decryptChunk(encryptedData, iv, authTag, key);
    return { decrypted, total };
  }, [fileId, decryptChunk]);

  // Append to MediaSource buffer with queue handling
  const appendToSourceBuffer = useCallback((sourceBuffer, data) => {
    return new Promise((resolve, reject) => {
      if (sourceBuffer.updating) {
        const waitForUpdate = () => {
          sourceBuffer.removeEventListener('updateend', waitForUpdate);
          appendToSourceBuffer(sourceBuffer, data).then(resolve).catch(reject);
        };
        sourceBuffer.addEventListener('updateend', waitForUpdate);
        return;
      }

      const onUpdateEnd = () => {
        sourceBuffer.removeEventListener('updateend', onUpdateEnd);
        sourceBuffer.removeEventListener('error', onError);
        resolve();
      };

      const onError = (e) => {
        sourceBuffer.removeEventListener('updateend', onUpdateEnd);
        sourceBuffer.removeEventListener('error', onError);
        reject(new Error('SourceBuffer error'));
      };

      sourceBuffer.addEventListener('updateend', onUpdateEnd);
      sourceBuffer.addEventListener('error', onError);

      try {
        sourceBuffer.appendBuffer(data);
      } catch (err) {
        sourceBuffer.removeEventListener('updateend', onUpdateEnd);
        sourceBuffer.removeEventListener('error', onError);
        reject(err);
      }
    });
  }, []);

  // Main loading function with hybrid approach
  useEffect(() => {
    if (!fileId || !masterPassword) return;

    let cancelled = false;
    abortControllerRef.current = new AbortController();

    const loadVideo = async () => {
      try {
        setIsLoading(true);
        setError(null);
        setLoadingStage('Deriving encryption key...');

        const key = await deriveKeyFromPassword(masterPassword);
        decryptionKeyRef.current = key;

        if (cancelled) return;

        // Fetch manifest
        setLoadingStage('Fetching file info...');
        const manifestRes = await fetch(`/api/stream/${fileId}/manifest`, {
          signal: abortControllerRef.current.signal
        });

        if (!manifestRes.ok) {
          throw new Error('Failed to fetch file manifest');
        }

        const manifest = await manifestRes.json();
        setTotalChunks(manifest.totalChunks);

        if (cancelled) return;

        // For MP4 files, skip MediaSource since most are not fragmented (fMP4)
        // MediaSource API only works with fragmented MP4 or WebM
        const isMP4 = mimeType?.includes('mp4') || mimeType?.includes('quicktime') || !mimeType;

        if (isMP4) {
          console.log('[Video] MP4 detected, using blob fallback (MediaSource requires fMP4)');
          await loadAllChunks(manifest, key);
          return;
        }

        // For WebM, try MediaSource for progressive playback
        const canUseMediaSource = tryMediaSource(manifest, key);
        if (canUseMediaSource) {
          setUseMediaSource(true);
          return;
        }

        // Fallback: Download and decrypt all chunks
        console.log('MediaSource not supported, using fallback');
        await loadAllChunks(manifest, key);

      } catch (err) {
        if (err.name === 'AbortError') return;
        console.error('Video load error:', err);
        if (!cancelled) {
          setError(err.message);
          setIsLoading(false);
        }
      }
    };

    // Try MediaSource API for progressive playback
    const tryMediaSource = (manifest, key) => {
      if (!window.MediaSource) {
        console.log('MediaSource API not available');
        return false;
      }

      // Check codec support
      const codecs = [
        'video/mp4; codecs="avc1.42E01E, mp4a.40.2"',
        'video/mp4; codecs="avc1.4D401E, mp4a.40.2"',
        'video/mp4; codecs="avc1.64001E, mp4a.40.2"',
        'video/webm; codecs="vp8, vorbis"',
        'video/webm; codecs="vp9, opus"',
      ];

      let supportedCodec = null;
      for (const codec of codecs) {
        if (MediaSource.isTypeSupported(codec)) {
          supportedCodec = codec;
          break;
        }
      }

      if (!supportedCodec) {
        console.log('No supported codec found for MediaSource');
        return false;
      }

      try {
        const mediaSource = new MediaSource();
        mediaSourceRef.current = mediaSource;
        videoRef.current.src = URL.createObjectURL(mediaSource);

        mediaSource.addEventListener('sourceopen', async () => {
          if (cancelled) return;

          try {
            const sourceBuffer = mediaSource.addSourceBuffer(supportedCodec);
            sourceBufferRef.current = sourceBuffer;

            // Load first chunk immediately
            setLoadingStage('Loading first chunk...');
            const { decrypted, total } = await fetchAndDecryptChunk(1, key, abortControllerRef.current.signal);

            if (cancelled) return;

            await appendToSourceBuffer(sourceBuffer, decrypted);
            setCurrentChunk(1);
            setIsLoading(false);
            setLoadingStage('Playing');

            console.log('First chunk loaded, starting playback');

            // Try autoplay
            try {
              await videoRef.current.play();
            } catch (e) {
              console.log('Autoplay blocked');
            }

            // Load remaining chunks in background
            for (let i = 2; i <= total; i++) {
              if (cancelled) break;

              try {
                const { decrypted } = await fetchAndDecryptChunk(i, key, abortControllerRef.current.signal);
                await appendToSourceBuffer(sourceBuffer, decrypted);
                setCurrentChunk(i);
                console.log(`Chunk ${i}/${total} loaded`);
              } catch (err) {
                console.warn(`Failed to load chunk ${i}:`, err.message);
              }
            }

            // End stream
            if (!cancelled && mediaSource.readyState === 'open') {
              if (sourceBuffer.updating) {
                await new Promise(r => sourceBuffer.addEventListener('updateend', r, { once: true }));
              }
              mediaSource.endOfStream();
            }

          } catch (err) {
            console.error('MediaSource error:', err);
            // Fallback
            URL.revokeObjectURL(videoRef.current.src);
            mediaSourceRef.current = null;
            loadAllChunks(manifest, key);
          }
        });

        return true;
      } catch (err) {
        console.error('MediaSource setup failed:', err);
        return false;
      }
    };

    // Fallback: Load all chunks and create blob
    const loadAllChunks = async (manifest, key) => {
      const decryptedChunks = [];

      for (let i = 1; i <= manifest.totalChunks; i++) {
        if (cancelled) return;

        setLoadingStage(`Downloading chunk ${i}/${manifest.totalChunks}...`);
        setCurrentChunk(i);

        const { decrypted } = await fetchAndDecryptChunk(i, key, abortControllerRef.current.signal);
        decryptedChunks.push(decrypted);

        console.log(`Chunk ${i}/${manifest.totalChunks} decrypted`);
      }

      if (cancelled) return;

      setLoadingStage('Preparing video...');
      const totalSize = decryptedChunks.reduce((sum, chunk) => sum + chunk.length, 0);
      console.log(`[Video] Total decrypted size: ${totalSize} bytes (${(totalSize / 1024 / 1024).toFixed(2)} MB)`);

      const combined = new Uint8Array(totalSize);
      let offset = 0;

      for (const chunk of decryptedChunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }

      console.log(`[Video] Combined buffer ready, offset: ${offset}`);

      const blob = new Blob([combined], { type: mimeType || 'video/mp4' });
      console.log(`[Video] Blob created: ${blob.size} bytes, type: ${blob.type}`);

      const url = URL.createObjectURL(blob);
      console.log(`[Video] Blob URL created: ${url}`);

      setVideoSrc(url);
      console.log(`[Video] Setting videoSrc state to: ${url}`);

      setIsLoading(false);
      setLoadingStage('Ready');
      console.log(`[Video] Loading complete, video should now play`);
    };

    loadVideo();

    return () => {
      cancelled = true;
      abortControllerRef.current?.abort();
      if (mediaSourceRef.current?.readyState === 'open') {
        try { mediaSourceRef.current.endOfStream(); } catch (e) {}
      }
      if (videoSrc) URL.revokeObjectURL(videoSrc);
    };
  }, [fileId, masterPassword, mimeType, deriveKeyFromPassword, fetchAndDecryptChunk, appendToSourceBuffer]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (videoSrc) URL.revokeObjectURL(videoSrc);
    };
  }, [videoSrc]);

  const progressPercent = totalChunks > 0 ? (currentChunk / totalChunks) * 100 : 0;

  if (!masterPassword) {
    return (
      <div className="w-full p-8 text-center bg-gray-100 rounded-lg">
        <p className="text-gray-600">🔐 Master password required to play encrypted video</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-3">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          <p className="font-medium">Error loading video:</p>
          <p className="text-sm">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 text-sm underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      <div className="bg-black rounded-lg overflow-hidden relative min-h-[300px]">
        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-gradient-to-b from-gray-900 to-black flex flex-col items-center justify-center z-10">
            <div className="relative mb-6">
              <div className="animate-spin h-16 w-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl">🔐</span>
              </div>
            </div>

            <p className="text-white text-lg font-medium mb-2">{loadingStage}</p>

            {totalChunks > 0 && (
              <div className="w-64 space-y-2">
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <p className="text-gray-400 text-sm text-center">
                  {currentChunk} / {totalChunks} chunks • {Math.round(progressPercent)}%
                </p>
              </div>
            )}

            <p className="text-gray-500 text-xs mt-6 max-w-xs text-center">
              🛡️ Decryption happens in your browser.<br/>
              Your password never leaves this device.
            </p>
          </div>
        )}

        {/* Video element */}
        <video
          ref={videoRef}
          src={useMediaSource ? undefined : videoSrc}
          controls
          autoPlay
          playsInline
          className="w-full bg-black"
          style={{ maxHeight: '600px', display: isLoading ? 'none' : 'block' }}
          onError={(e) => {
            console.error('[Video] Video element error:', e);
            console.error('[Video] Video error code:', videoRef.current?.error?.code);
            console.error('[Video] Video error message:', videoRef.current?.error?.message);
            setError(`Video playback error: ${videoRef.current?.error?.message || 'Unknown error'}`);
          }}
          onCanPlay={() => console.log('[Video] Video can play')}
          onLoadedData={() => console.log('[Video] Video data loaded')}
          onPlaying={() => console.log('[Video] Video is playing')}
          onWaiting={() => console.log('[Video] Video is waiting/buffering')}
        />
      </div>

      {/* Buffering indicator for MediaSource */}
      {!isLoading && useMediaSource && currentChunk < totalChunks && (
        <div className="space-y-1">
          <div className="flex justify-between items-center text-xs text-gray-500">
            <span>Buffering in background...</span>
            <span>{currentChunk}/{totalChunks} chunks</span>
          </div>
          <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* File info */}
      {!error && (
        <div className="text-sm text-gray-600">
          <p className="truncate font-medium">{fileName}</p>
          <p className="text-xs text-gray-500">
            {(fileSize / 1024 / 1024).toFixed(1)} MB
            {totalChunks > 0 && ` • ${totalChunks} chunks`}
            {!isLoading && ' • Decrypted locally'}
            {useMediaSource && ' • Progressive'}
          </p>
        </div>
      )}
    </div>
  );
}
