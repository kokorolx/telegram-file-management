'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useEncryption } from '../contexts/EncryptionContext';
import { decryptChunkBrowser } from '@/lib/clientDecryption';
import { blobCache } from '@/lib/secureImageCache';

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
  const { masterPassword, encryptionKey, salt } = useEncryption();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentChunk, setCurrentChunk] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);
  const [loadingStage, setLoadingStage] = useState('Initializing...');
  const [videoSrc, setVideoSrc] = useState(null);
  const [useMediaSource, setUseMediaSource] = useState(false);
  const [playbackMode, setPlaybackMode] = useState('initializing'); // initializing, progressive, full-download
  const [fallbackReason, setFallbackReason] = useState(null);

  const videoRef = useRef(null);
  const mediaSourceRef = useRef(null);
  const sourceBufferRef = useRef(null);
  const abortControllerRef = useRef(null);
  const decryptionKeyRef = useRef(null);

  // Removed local key derivation - using EncryptionContext

  const [mediaSourceUrl, setMediaSourceUrl] = useState(null);

  // Ref to store parts metadata for chunk lookups
  const partsRef = useRef([]);



  // Ref to track in-flight requests for deduplication
  const fetchingRef = useRef(new Map());

  // Fetch and decrypt a single chunk from API endpoint
   const fetchAndDecryptChunk = useCallback(async (chunkNum, key, signal) => {
      // Deduplication: Return existing promise if already fetching this chunk
      if (fetchingRef.current.has(chunkNum)) {
          console.log(`[VideoPlayer] Reusing in-flight request for chunk ${chunkNum}`);
          return fetchingRef.current.get(chunkNum);
      }

      const fetchPromise = (async () => {
          try {
              // Find metadata for this chunk
              const part = partsRef.current.find(p => p.part_number === chunkNum);
              if (!part) throw new Error(`Metadata missing for chunk ${chunkNum}`);

              console.log(`[VideoPlayer] Network Fetch: Chunk ${chunkNum}`);

              // Fetch raw encrypted chunk
              const response = await fetch(
                `/api/chunk/${encodeURIComponent(fileId)}/${chunkNum}`,
                { signal }
              );

              if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(`Failed to fetch chunk ${chunkNum}: ${data.error || response.status}`);
              }

              const encryptedBuffer = await response.arrayBuffer();
              const iv = new Uint8Array(part.iv.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
              const authTag = new Uint8Array(part.auth_tag.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));

              // Use centralized decryption utility (correctly handles CryptoKey import)
              const decrypted = await decryptChunkBrowser(
                new Uint8Array(encryptedBuffer),
                key,
                iv,
                authTag
              );

              return { decrypted, total: partsRef.current.length };
          } finally {
              if (fetchingRef.current.get(chunkNum) === fetchPromise) {
                  fetchingRef.current.delete(chunkNum);
              }
          }
      })();

      fetchingRef.current.set(chunkNum, fetchPromise);
      return fetchPromise;
    }, [fileId]);

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
        // Capture the actual error message from the SourceBuffer error event
        const errorMsg = sourceBuffer.error?.message || 'SourceBuffer error';
        reject(new Error(errorMsg));
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

        // Wait for encryption key to be ready
        if (!encryptionKey) {
            setLoadingStage('Waiting for encryption key...');
            return;
        }

        const masterKey = encryptionKey; // This is the user's derived master key

        if (cancelled) return;

        // Fetch file parts metadata
         setLoadingStage('Fetching file info...');
         const partsRes = await fetch(`/api/files/${encodeURIComponent(fileId)}/parts`, {
           signal: abortControllerRef.current.signal
         });

         if (!partsRes.ok) {
           throw new Error('Failed to fetch file parts');
         }

         const partsData = await partsRes.json();
         const totalChunks = partsData.parts.length;
         partsRef.current = partsData.parts;
         setTotalChunks(totalChunks);

         // Helper to unwrap file key if envelope encryption is used
         let fileKey = masterKey;
         if (partsData.file?.key_data) {
             setLoadingStage('Unwrapping file key...');
             try {
                 const { unwrapKey } = await import('@/lib/envelopeCipher');
                 const { encrypted_key, iv } = partsData.file.key_data;
                 // unwrapKey(wrappedKeyBase64, keyMaterial, salt, ivHex)
                 fileKey = await unwrapKey(encrypted_key, masterKey, null, iv);
                 console.log('[VideoPlayer] Successfully unwrapped DEK for file');
             } catch (err) {
                 console.error('[VideoPlayer] Failed to unwrap DEK:', err);
                 throw new Error(`Failed to unlock file key: ${err.message}`);
             }
         }
         decryptionKeyRef.current = fileKey;
         const key = fileKey;

         // Create manifest-like object for compatibility
         const manifest = { totalChunks, parts: partsData.parts };

        if (cancelled) return;

        // Check if video is fragmented for progressive playback
        // Use metadata from API as the single source of truth
        const actualMimeType = partsData.file?.mime_type || mimeType;
        const isMP4 = actualMimeType?.includes('mp4') || actualMimeType?.includes('quicktime') || !actualMimeType;
        const isFragmented = partsData.file?.is_fragmented === true;

        console.log('[VideoPlayer] Playback diagnostic:', {
          isMP4,
          isFragmented,
          mimeType: actualMimeType,
          fileName,
          totalChunks
        });

        // For non-fragmented MP4/MOV, download all chunks first
        // MediaSource API only works with fragmented MP4/MOV or WebM
        if (isMP4 && !isFragmented) {
          console.log('[VideoPlayer] Using Full Download: Video is not fragmented.');
          setPlaybackMode('full-download');
          setFallbackReason('Video not fragmented');
          await loadAllChunks(manifest, key);
          return;
        }

        // For WebM or fragmented MP4/MOV, try MediaSource for progressive playback
        console.log('[VideoPlayer] Attempting MediaSource API setup...');
        const canUseMediaSource = tryMediaSource(manifest, key);

        if (canUseMediaSource) {
          console.log('[VideoPlayer] MediaSource API initialized successfully.');
          setUseMediaSource(true);
          setPlaybackMode('progressive');
          return;
        }

        // Fallback: Download and decrypt all chunks
        console.warn('[VideoPlayer] MediaSource not supported or initialization failed. Falling back to Full Download.');
        setPlaybackMode('full-download');
        // fallbackReason is set inside tryMediaSource on failure
        await loadAllChunks(manifest, key);

      } catch (err) {
        if (err.name === 'AbortError') return;
        console.error('[VideoPlayer] FATAL ERROR during loadVideo:', err);
        setError(`Playback failed: ${err.message}`);
      }
    };

    /**
     * Try to setup MediaSource API for progressive playback
     */
    const tryMediaSource = (manifest, key) => {
      if (typeof window === 'undefined' || !window.MediaSource) {
        console.warn('[VideoPlayer] MediaSource API not available in this browser.');
        setFallbackReason('MediaSource API unsupported');
        return false;
      }

      // Check codec support
      // Try to be more inclusive to find ANY supported format
      const codecs = [
        'video/mp4; codecs="avc1.640029, mp4a.40.2"', // High Profile Level 4.1 (Common)
        'video/mp4; codecs="avc1.640028, mp4a.40.2"', // High Profile Level 4.0
        'video/mp4; codecs="avc1.4D4029, mp4a.40.2"', // Main Profile Level 4.1
        'video/mp4; codecs="avc1.4D4028, mp4a.40.2"', // Main Profile Level 4.0
        'video/mp4; codecs="avc1.42E01E, mp4a.40.2"', // Baseline
        'video/mp4; codecs="avc1.64001E, mp4a.40.2"', // High
        'video/mp4; codecs="avc1.4D401E, mp4a.40.2"', // Main
        'video/mp4; codecs="hvc1.1.6.L93.B0, mp4a.40.2"', // HEVC Main
        'video/mp4; codecs="hev1.1.6.L93.B0, mp4a.40.2"', // HEVC Main (Apple)
        'video/mp4', // Generic fallback
        'video/webm; codecs="vp9, opus"',
        'video/webm; codecs="vp8, vorbis"',
        'video/webm',
      ];

      let supportedCodec = null;
      for (const codec of codecs) {
        if (MediaSource.isTypeSupported(codec)) {
          supportedCodec = codec;
          console.log(`[VideoPlayer] Browser supports codec: ${codec}`);
          break;
        }
      }

      if (!supportedCodec) {
        console.warn('[VideoPlayer] No compatible codecs found for MediaSource.');
        setFallbackReason('No compatible codec found');
        return false;
      }

      try {
        const mediaSource = new MediaSource();
        mediaSourceRef.current = mediaSource;
        const msUrl = URL.createObjectURL(mediaSource);
        setMediaSourceUrl(msUrl);
        // We still set it manually to be safe, but state-driven src is primary now
        if (videoRef.current) videoRef.current.src = msUrl;

        mediaSource.addEventListener('sourceopen', async () => {
          if (cancelled) return;

          try {
            let sourceBuffer;
             try {
               sourceBuffer = mediaSource.addSourceBuffer(supportedCodec);
             } catch (e) {
                console.warn('[VideoPlayer] addSourceBuffer failed for preferred codec, trying video-only:', e);
                // Try video only as immediate fallback if first add fails
                const videoOnlyCodec = supportedCodec.replace(', mp4a.40.2', '').replace(', opus', '').replace(', vorbis', '');
                sourceBuffer = mediaSource.addSourceBuffer(videoOnlyCodec);
             }

            sourceBufferRef.current = sourceBuffer;

            // Load first chunk immediately
            setLoadingStage('Loading first chunk...');
            const { decrypted, total } = await fetchAndDecryptChunk(1, key, abortControllerRef.current.signal);

            if (cancelled) return;

            try {
                await appendToSourceBuffer(sourceBuffer, decrypted);
            } catch (err) {
                 // Specific Error Handling for Audio Mismatch (common with screen recordings)
                 if (err.message && (err.message.includes('aac track') || err.message.includes('audio track') || err.message.includes('Initialization segment misses expected') || err.message.includes('CHUNK_DEMUXER'))) {
                     console.warn('[VideoPlayer] Audio track mismatch detected. Retrying with video-only codec...');

                     // Clean up bad buffer - wait for state to settle
                     if (sourceBuffer.updating) {
                       await new Promise(r => sourceBuffer.addEventListener('updateend', r, { once: true }));
                     }
                     try { 
                       mediaSource.removeSourceBuffer(sourceBuffer); 
                     } catch(e) {
                       console.warn('[VideoPlayer] Failed to remove sourceBuffer:', e);
                     }

                     // Create new buffer without audio codec
                     const videoOnlyCodec = supportedCodec.replace(/, mp4a\.40\.2/g, '').replace(/, opus/g, '').replace(/, vorbis/g, '');
                     console.log(`[VideoPlayer] Switching to video-only codec: ${videoOnlyCodec}`);

                     sourceBuffer = mediaSource.addSourceBuffer(videoOnlyCodec);
                     sourceBufferRef.current = sourceBuffer;

                     await appendToSourceBuffer(sourceBuffer, decrypted);
                     console.log('[VideoPlayer] Successfully recovered with video-only codec');
                 } else {
                     throw err; // Re-throw other errors
                 }
            }

            // DIAGNOSTIC EXTREME: Log first 16 bytes to check for ftyp/moov (valid MP4)
            const headerBytes = Array.from(decrypted.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' ');
            console.log(`[VideoPlayer] Decrypted Header (Hex): ${headerBytes}`);

            // DIAGNOSTIC: Check what actually happened after append
            if (videoRef.current) {
              const buffered = videoRef.current.buffered;
              const ranges = [];
              for(let i=0; i<buffered.length; i++) {
                ranges.push(`[${buffered.start(i).toFixed(2)}s - ${buffered.end(i).toFixed(2)}s]`);
              }
              console.log(`[VideoPlayer] Post-append state:`, {
                readyState: videoRef.current.readyState,
                paused: videoRef.current.paused,
                error: videoRef.current.error,
                buffered: ranges.join(', '),
                currentTime: videoRef.current.currentTime
              });
            }

            console.log(`[VideoPlayer] Successfully appended first chunk (${decrypted.length} bytes). Total parts: ${totalChunks}`);
            setCurrentChunk(1);
            setIsLoading(false);
            setLoadingStage('Playing');


            // Try autoplay
            try {
              await videoRef.current.play();
              console.log('[VideoPlayer] Playback started successfully');
            } catch (e) {
              console.warn('[VideoPlayer] Autoplay failed:', e.message);
            }

            // Load remaining chunks in background
            for (let i = 2; i <= total; i++) {
              if (cancelled) break;

              try {
                const { decrypted } = await fetchAndDecryptChunk(i, key, abortControllerRef.current.signal);
                await appendToSourceBuffer(sourceBuffer, decrypted);
                setCurrentChunk(i);
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
            if (videoRef.current && videoRef.current.src) {
                URL.revokeObjectURL(videoRef.current.src);
            }
            mediaSourceRef.current = null;
            loadAllChunks(manifest, key);
          }
        });

        return true;
      } catch (err) {
        console.error('MediaSource setup failed:', err);
        setFallbackReason(`MSE Setup Failed: ${err.message}`);
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

      }

      if (cancelled) return;

      setLoadingStage('Preparing video...');
      const totalSize = decryptedChunks.reduce((sum, chunk) => sum + chunk.length, 0);

      const combined = new Uint8Array(totalSize);
      let offset = 0;

      for (const chunk of decryptedChunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }


      const blob = new Blob([combined], { type: mimeType || 'video/mp4' });

      const url = URL.createObjectURL(blob);

      setVideoSrc(url);
      blobCache.set(fileId, { url, timestamp: Date.now() });

      setIsLoading(false);
      setLoadingStage('Ready');
    };

    loadVideo();

    return () => {
      cancelled = true;
      abortControllerRef.current?.abort();
      if (mediaSourceRef.current?.readyState === 'open') {
        try { mediaSourceRef.current.endOfStream(); } catch (e) {}
      }
      if (videoSrc) URL.revokeObjectURL(videoSrc);
      if (mediaSourceUrl) URL.revokeObjectURL(mediaSourceUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileId, encryptionKey, masterPassword, mimeType, fetchAndDecryptChunk, appendToSourceBuffer]);

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
          src={useMediaSource ? mediaSourceUrl : videoSrc}
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
          onWaiting={() => {}}
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
            {useMediaSource ? (
              <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded-md font-bold">Progressive</span>
            ) : (
              <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-md font-bold">
                Full Download {fallbackReason && `(${fallbackReason})`}
              </span>
            )}
            {totalChunks > 0 && ` • ${totalChunks} chunks`}
            {!isLoading && ' • Decrypted locally'}
          </p>
        </div>
      )}
    </div>
  );
}
