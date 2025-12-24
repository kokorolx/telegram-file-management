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
   const backgroundLoaderRef = useRef(null);

  // Removed local key derivation - using EncryptionContext

  const [mediaSourceUrl, setMediaSourceUrl] = useState(null);

  // Ref to store parts metadata for chunk lookups
  const partsRef = useRef([]);
  const totalChunksRef = useRef(0);

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

              console.log(`[VideoPlayer] Chunk ${chunkNum} decrypted: ${encryptedBuffer.length} bytes encrypted -> ${decrypted.length} bytes decrypted`);
              return { decrypted, total: totalChunksRef.current };
          } finally {
              if (fetchingRef.current.get(chunkNum) === fetchPromise) {
                  fetchingRef.current.delete(chunkNum);
              }
          }
      })();

      fetchingRef.current.set(chunkNum, fetchPromise);
      return fetchPromise;
    }, [fileId]);

  // Extract video duration from moov box in MP4 init segment
  // moov contains trak->tkhd and trak->mdia->mdhd which has duration info
  const extractDurationFromMoov = (data) => {
    try {
      const dv = new DataView(data.buffer, data.byteOffset, data.length);
      
      // Debug: show first 100 bytes to see structure
      const hex = Array.from(data.slice(0, 100)).map(b => b.toString(16).padStart(2, '0')).join(' ');
      console.log(`[extractDurationFromMoov] First 100 bytes (hex): ${hex}`);
      
      // Look for 'moov' box (0x6d6f6f76)
      let moovStart = -1;
      for (let i = 0; i < data.length - 4; i++) {
        if (data[i] === 0x6d && data[i+1] === 0x6f && data[i+2] === 0x6f && data[i+3] === 0x76) {
          moovStart = i;
          console.log(`[extractDurationFromMoov] Found moov at offset ${moovStart} (size preceding: ${dv.getUint32(moovStart - 4, false)})`);
          break;
        }
      }
      
      if (moovStart === -1) {
        console.warn('[extractDurationFromMoov] moov box not found in init segment (searched', data.length, 'bytes)');
        return null;
      }
      
      console.log(`[extractDurationFromMoov] Found moov at offset ${moovStart}`);
      
      // Go back 4 bytes to get size
      const moovSize = dv.getUint32(moovStart - 4, false); // big-endian
      const moovEnd = moovStart + moovSize;
      
      if (moovEnd > data.length) {
        console.warn(`[extractDurationFromMoov] moov box incomplete: size=${moovSize}, available=${data.length - moovStart}`);
        return null;
      }
      
      // Look for 'mdhd' box (0x6d646864) which contains duration
      let mdhdStart = -1;
      for (let i = moovStart; i < moovEnd - 4; i++) {
        if (data[i] === 0x6d && data[i+1] === 0x64 && data[i+2] === 0x68 && data[i+3] === 0x64) {
          mdhdStart = i;
          break;
        }
      }
      
      if (mdhdStart === -1) {
        console.warn('[extractDurationFromMoov] mdhd box not found in moov');
        return null;
      }
      
      console.log(`[extractDurationFromMoov] Found mdhd at offset ${mdhdStart}`);
      
      // mdhd box structure:
      // [4] size
      // [4] 'mdhd'
      // [1] version
      // [3] flags
      // then either version 0 or 1
      
      const mdhdDataStart = mdhdStart + 8; // skip size + 'mdhd'
      const version = data[mdhdDataStart];
      const flags = (data[mdhdDataStart + 1] << 16) | (data[mdhdDataStart + 2] << 8) | data[mdhdDataStart + 3];
      
      let timescale, duration;
      
      if (version === 0) {
        // Version 0: 32-bit values
        // [4] creation_time
        // [4] modification_time
        // [4] timescale
        // [4] duration
        const timeScaleOffset = mdhdDataStart + 4 + 8;
        const durationOffset = timeScaleOffset + 4;
        
        if (durationOffset + 4 > data.length) {
          console.warn('[extractDurationFromMoov] mdhd v0 data incomplete');
          return null;
        }
        
        timescale = dv.getUint32(timeScaleOffset, false);
        duration = dv.getUint32(durationOffset, false);
      } else if (version === 1) {
        // Version 1: 64-bit values
        // [8] creation_time
        // [8] modification_time
        // [4] timescale
        // [8] duration
        const timeScaleOffset = mdhdDataStart + 4 + 16;
        const durationOffset = timeScaleOffset + 4;
        
        if (durationOffset + 8 > data.length) {
          console.warn('[extractDurationFromMoov] mdhd v1 data incomplete');
          return null;
        }
        
        timescale = dv.getUint32(timeScaleOffset, false);
        // For 64-bit, just use lower 32 bits (assume duration < 4GB ticks)
        duration = dv.getUint32(durationOffset + 4, false);
      } else {
        console.warn(`[extractDurationFromMoov] Unsupported mdhd version: ${version}`);
        return null;
      }
      
      if (timescale === 0) {
        console.warn('[extractDurationFromMoov] invalid timescale=0');
        return null;
      }
      
      const durationInSeconds = duration / timescale;
      console.log(`[extractDurationFromMoov] v${version} duration=${duration}, timescale=${timescale} -> ${durationInSeconds.toFixed(2)}s`);
      
      return durationInSeconds > 0 ? durationInSeconds : null;
    } catch (e) {
      console.error('[extractDurationFromMoov] Exception:', e.message);
      return null;
    }
  };

  // Append to MediaSource buffer with queue handling
  const appendToSourceBuffer = useCallback((sourceBuffer, data) => {
    return new Promise((resolve, reject) => {
      if (sourceBuffer.updating) {
        console.log('[appendToSourceBuffer] SourceBuffer is updating, waiting for updateend...');
        const waitForUpdate = () => {
          console.log('[appendToSourceBuffer] SourceBuffer updateend received, retrying append...');
          sourceBuffer.removeEventListener('updateend', waitForUpdate);
          appendToSourceBuffer(sourceBuffer, data).then(resolve).catch(reject);
        };
        sourceBuffer.addEventListener('updateend', waitForUpdate);
        return;
      }

      const onUpdateEnd = () => {
        sourceBuffer.removeEventListener('updateend', onUpdateEnd);
        sourceBuffer.removeEventListener('error', onError);
        console.log('[appendToSourceBuffer] Successfully appended data');
        resolve();
      };

      const onError = (e) => {
        sourceBuffer.removeEventListener('updateend', onUpdateEnd);
        sourceBuffer.removeEventListener('error', onError);
        // Capture the actual error message from the SourceBuffer error event
        const errorMsg = sourceBuffer.error?.message || 'SourceBuffer error';
        console.error('[appendToSourceBuffer] Error event:', errorMsg);
        reject(new Error(errorMsg));
      };

      sourceBuffer.addEventListener('updateend', onUpdateEnd);
      sourceBuffer.addEventListener('error', onError);

      try {
        console.log(`[appendToSourceBuffer] Appending ${data.length} bytes to sourceBuffer...`);
        sourceBuffer.appendBuffer(data);
      } catch (err) {
        sourceBuffer.removeEventListener('updateend', onUpdateEnd);
        sourceBuffer.removeEventListener('error', onError);
        console.error('[appendToSourceBuffer] Exception during appendBuffer:', err.message);
        reject(err);
      }
    });
  }, []);

  // Load chunks on-demand (when user seeks or buffer runs low)
   // CRITICAL: Load all chunks FIRST, then append in order. This prevents timestamp/sync issues.
   const loadChunksOnDemand = useCallback(async (startChunk, endChunk, key) => {
     if (!sourceBufferRef.current || !mediaSourceRef.current) return;
     
     console.log(`[VideoPlayer] On-demand loading chunks ${startChunk}-${endChunk}`);
     
     // Step 1: Fetch ALL chunks first (prevents out-of-order issues)
     const chunksToAppend = [];
     for (let i = startChunk; i <= endChunk; i++) {
       if (abortControllerRef.current?.signal.aborted) {
         console.log(`[VideoPlayer] On-demand load cancelled at chunk ${i}`);
         return;
       }
       
       try {
         // Check if already buffered
         const buffered = videoRef.current?.buffered;
         if (buffered && buffered.length > 0) {
           // Rough check: if we have any buffered content, skip
           if (videoRef.current.duration && buffered.end(buffered.length - 1) > (i / totalChunksRef.current) * videoRef.current.duration) {
             console.log(`[VideoPlayer] Chunk ${i} likely already buffered, skipping`);
             continue;
           }
         }
         
         console.log(`[VideoPlayer] On-demand fetching chunk ${i}...`);
         const { decrypted } = await fetchAndDecryptChunk(i, key, abortControllerRef.current.signal);
         chunksToAppend.push({ chunkNum: i, decrypted });
       } catch (err) {
         console.error(`[VideoPlayer] On-demand fetch failed for chunk ${i}:`, err.message);
         // Continue fetching remaining chunks
       }
     }
     
     // Step 2: Append all fetched chunks in order
     if (chunksToAppend.length === 0) {
       console.warn(`[VideoPlayer] No chunks fetched for on-demand load`);
       return;
     }
     
     console.log(`[VideoPlayer] Fetched ${chunksToAppend.length} chunks, appending in order...`);
     
     for (const { chunkNum, decrypted } of chunksToAppend) {
       if (abortControllerRef.current?.signal.aborted) {
         console.log(`[VideoPlayer] On-demand append cancelled at chunk ${chunkNum}`);
         return;
       }
       
       try {
         // Check video element error state BEFORE append
         if (videoRef.current?.error) {
           console.error(`[VideoPlayer] Video element in error state (${videoRef.current.error.code}) - aborting on-demand load`);
           return;
         }
         
         // Wait for sourceBuffer to be ready
         if (sourceBufferRef.current.updating) {
           await new Promise(r => sourceBufferRef.current.addEventListener('updateend', r, { once: true }));
         }
         
         await appendToSourceBuffer(sourceBufferRef.current, decrypted);
         setCurrentChunk(chunkNum);
         console.log(`[VideoPlayer] On-demand appended chunk ${chunkNum}`);
       } catch (err) {
         console.error(`[VideoPlayer] On-demand append failed for chunk ${chunkNum}:`, err.message);
         
         // If append fails, video element likely entered error state
         // Subsequent appends will fail, so we must stop
         if (videoRef.current?.error) {
           console.error(`[VideoPlayer] Video element entered error state during on-demand append - stopping load`);
           return;
         }
       }
     }
     
     console.log(`[VideoPlayer] On-demand load completed`);
   }, [fetchAndDecryptChunk, appendToSourceBuffer]);

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
         totalChunksRef.current = totalChunks;
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
          const canUseMediaSource = tryMediaSource(manifest, key, isFragmented);

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
         const tryMediaSource = (manifest, key, isFragmented) => {
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
                 // Specific Error Handling for Audio/Codec Mismatch or Demuxer Errors
                 // These are common with screen recordings and fragmented/re-encoded video
                 const isMediaError = err.message && (
                   err.message.includes('aac track') || 
                   err.message.includes('audio track') || 
                   err.message.includes('Initialization segment misses expected') || 
                   err.message.includes('CHUNK_DEMUXER') ||
                   err.message.includes('Failed to prepare') ||
                   err.message.includes('codec')
                 );

                 if (isMediaError) {
                     console.warn('[VideoPlayer] MediaSource append error detected. Attempting recovery with video-only codec...');

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

                     try {
                       sourceBuffer = mediaSource.addSourceBuffer(videoOnlyCodec);
                       sourceBufferRef.current = sourceBuffer;
                       await appendToSourceBuffer(sourceBuffer, decrypted);
                       console.log('[VideoPlayer] Successfully recovered with video-only codec');
                     } catch (retryErr) {
                       console.warn('[VideoPlayer] Video-only codec recovery failed, falling back to full-download:', retryErr.message);
                       throw new Error('MediaSource recovery failed, falling back to full-download');
                     }
                 } else {
                     throw err; // Re-throw other errors
                 }
            }

            // DIAGNOSTIC EXTREME: Log first 16 bytes to check for ftyp/moov (valid MP4)
            const headerBytes = Array.from(decrypted.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' ');
            console.log(`[VideoPlayer] Decrypted Header (Hex): ${headerBytes}`);
            
            // Try to extract duration from moov box (for timeline scrubbing)
            let videoDuration = null;
            if (isFragmented) {
              try {
                videoDuration = extractDurationFromMoov(decrypted);
                if (videoDuration && videoDuration > 0) {
                  console.log(`[VideoPlayer] ✓ Set mediaSource.duration = ${videoDuration.toFixed(2)}s`);
                  mediaSource.duration = videoDuration;
                } else {
                  console.warn(`[VideoPlayer] Duration extraction failed or returned invalid value: ${videoDuration}`);
                  // Fallback: estimate from chunk count + file size
                  // Average chunk is ~2.5MB, typical bitrate for video is ~2Mbps, so ~10 sec per 2.5MB
                  // More conservative: assume ~20-25 sec per chunk for 2-3MB chunks
                  const estimatedDuration = total * 25; // 25 sec per chunk is reasonable for 2-3MB chunks
                  console.log(`[VideoPlayer] Using estimated duration: ${estimatedDuration}s (${total} chunks × 25s)`);
                  mediaSource.duration = estimatedDuration;
                }
              } catch (e) {
                console.error(`[VideoPlayer] Exception during duration extraction:`, e.message);
                // Fallback: estimate from chunk count (~20-25 sec per 2-3MB chunk)
                const fallbackDuration = total * 25;
                console.log(`[VideoPlayer] Using fallback duration: ${fallbackDuration}s`);
                mediaSource.duration = fallbackDuration;
              }
            }

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

            console.log(`[VideoPlayer] Successfully appended first chunk (${decrypted.length} bytes). Total parts: ${total}`);
            
            // For fragmented videos: init segment + buffer threshold for progressive streaming
            // For non-fragmented: just load remaining chunks as-is
            if (isFragmented) {
              console.log('[VideoPlayer] Fragmented video: chunk 1 is init segment, starting progressive playback...');
              setCurrentChunk(1);
              
              // PROGRESSIVE STREAMING: Load minimal chunks before starting playback
              const BUFFER_THRESHOLD = 3; // Start playback after init + 2 media chunks
              let chunksBuffered = 1; // Already have chunk 1 (init segment)
              
              // Load chunks until we reach buffer threshold
              console.log(`[VideoPlayer] Buffering to threshold (${BUFFER_THRESHOLD} chunks)...`);
              for (let i = 2; i <= Math.min(BUFFER_THRESHOLD, total); i++) {
                if (cancelled) {
                  console.log(`[VideoPlayer] Chunk loading cancelled at chunk ${i}`);
                  break;
                }

                try {
                  console.log(`[VideoPlayer] Pre-buffering chunk ${i}/${total}...`);
                  const { decrypted: mediaDecrypted } = await fetchAndDecryptChunk(i, key, abortControllerRef.current.signal);
                  console.log(`[VideoPlayer] Fetched chunk ${i} (${mediaDecrypted.length} bytes), appending...`);
                  await appendToSourceBuffer(sourceBuffer, mediaDecrypted);
                  console.log(`[VideoPlayer] Successfully appended chunk ${i}`);
                  setCurrentChunk(i);
                  chunksBuffered++;
                } catch (err) {
                  console.error(`[VideoPlayer] Failed to pre-buffer chunk ${i}:`, err.message);
                  // Continue anyway - try to start playback even with partial buffer
                }
              }
              
              // Enough buffered, allow playback to start
              setIsLoading(false);
              setLoadingStage(`Playing (buffering: ${chunksBuffered}/${total} chunks)`);
              
              // Try to play immediately
              try {
                console.log('[VideoPlayer] Attempting to play...');
                await videoRef.current.play();
                console.log('[VideoPlayer] Playback started');
              } catch (e) {
                console.warn('[VideoPlayer] Play failed:', e.message);
              }
              
              // Continuous background buffer refill
              // Keep 5-10 chunks ahead of playhead, load more as video plays
              const MAX_CHUNKS_AHEAD = 8;
              let nextChunkToLoad = BUFFER_THRESHOLD + 1;
              let allChunksLoaded = false;
              
              console.log(`[VideoPlayer] Starting continuous background load (max ${MAX_CHUNKS_AHEAD} chunks ahead)`);
              
              const backgroundLoader = setInterval(async () => {
                if (cancelled || allChunksLoaded) {
                  clearInterval(backgroundLoader);
                  return;
                }
                
                try {
                  // Check how many chunks are buffered ahead of playhead
                  const buffered = videoRef.current?.buffered;
                  const currentTime = videoRef.current?.currentTime || 0;
                  const totalDuration = mediaSource.duration || 1;
                  
                  if (!buffered || buffered.length === 0) return;
                  
                  const bufferedEnd = buffered.end(buffered.length - 1);
                  const bufferedAhead = bufferedEnd - currentTime;
                  const secondsPerChunk = totalDuration / total;
                  const chunksAhead = Math.ceil(bufferedAhead / secondsPerChunk);
                  
                  // If we have less than MAX_CHUNKS_AHEAD, load more
                  if (chunksAhead < MAX_CHUNKS_AHEAD && nextChunkToLoad <= total) {
                    console.log(`[VideoPlayer] Buffer low (${chunksAhead} chunks ahead), loading chunk ${nextChunkToLoad}...`);
                    
                    const { decrypted: mediaDecrypted } = await fetchAndDecryptChunk(nextChunkToLoad, key, abortControllerRef.current.signal);
                    
                    if (sourceBuffer.updating) {
                      await new Promise(r => sourceBuffer.addEventListener('updateend', r, { once: true }));
                    }
                    
                    await appendToSourceBuffer(sourceBuffer, mediaDecrypted);
                    setCurrentChunk(nextChunkToLoad);
                    nextChunkToLoad++;
                    
                    if (nextChunkToLoad > total) {
                      allChunksLoaded = true;
                      clearInterval(backgroundLoader);
                      
                      // Signal end of stream when all chunks loaded
                      if (mediaSource.readyState === 'open') {
                        if (sourceBuffer.updating) {
                          await new Promise(r => sourceBuffer.addEventListener('updateend', r, { once: true }));
                        }
                        try {
                          mediaSource.endOfStream();
                          console.log('[VideoPlayer] All chunks loaded, signaled endOfStream');
                        } catch (e) {
                          console.warn('[VideoPlayer] endOfStream failed:', e.message);
                        }
                      }
                    }
                  }
                } catch (err) {
                  console.error(`[VideoPlayer] Background load error:`, err.message);
                  
                  // If video element entered error state, stop background loading
                  if (videoRef.current?.error) {
                    console.error(`[VideoPlayer] Video element error during background load, stopping background loader`);
                    clearInterval(backgroundLoader);
                    allChunksLoaded = true;
                    return;
                  }
                  
                  if (err.message.includes('SourceBuffer is full')) {
                    console.log(`[VideoPlayer] Buffer full, pausing background load`);
                  }
                }
              }, 1000); // Check every second
               
              // Store interval for cleanup
              backgroundLoaderRef.current = backgroundLoader;
            } else {
              // Non-fragmented: original behavior
              setCurrentChunk(1);
              setIsLoading(false);
              setLoadingStage('Playing');
              
              console.log(`[VideoPlayer] Starting background chunk load from 2 to ${total}`);
              let chunksLoaded = 1;
              
              for (let i = 2; i <= total; i++) {
                if (cancelled) break;
                try {
                  const { decrypted: mediaDecrypted } = await fetchAndDecryptChunk(i, key, abortControllerRef.current.signal);
                  await appendToSourceBuffer(sourceBuffer, mediaDecrypted);
                  setCurrentChunk(i);
                  chunksLoaded++;
                  
                  if (chunksLoaded === 3 && !videoRef.current?.playing) {
                    try {
                      await videoRef.current.play();
                      console.log('[VideoPlayer] Playback started');
                    } catch (e) {
                      console.warn('[VideoPlayer] Play failed:', e.message);
                    }
                  }
                } catch (err) {
                  console.error(`[VideoPlayer] Failed to load chunk ${i}:`, err.message);
                }
              }
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
       if (backgroundLoaderRef.current) {
         clearInterval(backgroundLoaderRef.current);
       }
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
            const errorCode = videoRef.current?.error?.code;
            const errorMsg = videoRef.current?.error?.message;
            const errorNames = {
              1: 'MEDIA_ERR_ABORTED',
              2: 'MEDIA_ERR_NETWORK',
              3: 'MEDIA_ERR_DECODE',
              4: 'MEDIA_ERR_SRC_NOT_SUPPORTED'
            };
            console.error('[Video] Error code:', errorCode, `(${errorNames[errorCode] || 'Unknown'})`);
            console.error('[Video] Error message:', errorMsg);
            console.error('[Video] Buffered ranges:', videoRef.current?.buffered.length, 'ranges');
            if (videoRef.current?.buffered.length > 0) {
              for (let i = 0; i < videoRef.current.buffered.length; i++) {
                console.error(`  [${i}]: ${videoRef.current.buffered.start(i).toFixed(2)}s - ${videoRef.current.buffered.end(i).toFixed(2)}s`);
              }
            }
            setError(`Video playback error (${errorNames[errorCode] || 'Code ' + errorCode}): ${errorMsg || 'Unknown'}`);
          }}
          onWaiting={() => {}}
          onSeeking={() => {
            // User is seeking - may need to fetch chunks if seeking to unbuffered area
            if (useMediaSource && videoRef.current && sourceBufferRef.current && mediaSourceRef.current) {
              // CRITICAL: If video is already in error state, don't attempt to load more chunks
              if (videoRef.current.error) {
                console.error(`[VideoPlayer] Video in error state - ignoring seek request: ${videoRef.current.error.message}`);
                return;
              }
              
              const seekTime = videoRef.current.currentTime;
              const buffered = videoRef.current.buffered;
              const totalDuration = mediaSourceRef.current.duration;
              
              // Validate duration before calculations
              if (!totalDuration || totalDuration <= 0 || !isFinite(totalDuration)) {
                console.warn(`[VideoPlayer] Invalid duration for seek: ${totalDuration}`);
                return;
              }
              
              // Clamp seek time to valid range
              const clampedSeekTime = Math.max(0, Math.min(seekTime, totalDuration));
              
              // Check if seek target is buffered
              let isBuffered = false;
              for (let i = 0; i < buffered.length; i++) {
                if (clampedSeekTime >= buffered.start(i) && clampedSeekTime <= buffered.end(i)) {
                  isBuffered = true;
                  console.log(`[VideoPlayer] Seek to ${clampedSeekTime.toFixed(2)}s is buffered`);
                  break;
                }
              }
              
              if (!isBuffered) {
                // Calculate which chunks we need to load to cover the seek gap
                // Use time-based calculation: each chunk covers (duration / totalChunks) seconds
                const secondsPerChunk = totalDuration / totalChunksRef.current;
                
                // Estimated chunk at seek position
                const estimatedChunk = Math.max(2, Math.ceil(clampedSeekTime / secondsPerChunk));
                
                // Find the last contiguous buffered chunk
                let lastBufferedChunk = 1;
                if (buffered.length > 0) {
                  const bufferedEnd = buffered.end(buffered.length - 1);
                  lastBufferedChunk = Math.max(1, Math.ceil(bufferedEnd / secondsPerChunk));
                }
                
                const startChunk = Math.max(2, lastBufferedChunk + 1);
                const endChunk = Math.min(estimatedChunk + 2, totalChunksRef.current); // Get seek target + 2 buffer chunks
                
                console.log(`[VideoPlayer] Seek to ${clampedSeekTime.toFixed(2)}s (unbuffered). Last buffered: chunk ${lastBufferedChunk}, seek target: chunk ${estimatedChunk}, loading: ${startChunk}-${endChunk}`);
                
                // Load chunks asynchronously without blocking playback
                if (decryptionKeyRef.current && abortControllerRef.current && !abortControllerRef.current.signal.aborted) {
                  // Use Promise to avoid blocking (don't await here)
                  loadChunksOnDemand(startChunk, endChunk, decryptionKeyRef.current)
                    .catch(err => console.error(`[VideoPlayer] Seek-triggered on-demand load failed:`, err.message));
                }
              }
            }
          }}
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
