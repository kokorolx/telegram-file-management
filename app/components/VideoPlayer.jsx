'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useEncryption } from '../contexts/EncryptionContext';
import { decryptChunkBrowser } from '@/lib/clientDecryption';
import { blobCache } from '@/lib/secureImageCache';
import { config } from '@/lib/config';

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
  const [isSeekBuffering, setIsSeekBuffering] = useState(false); // Track on-demand seek loading
  const [seekLoadingPercent, setSeekLoadingPercent] = useState(0); // Track seek loading progress

  const videoRef = useRef(null);
   const mediaSourceRef = useRef(null);
   const sourceBufferRef = useRef(null);
   const abortControllerRef = useRef(null);
   const decryptionKeyRef = useRef(null);
   const backgroundLoaderRef = useRef(null);
   const backgroundLoaderStateRef = useRef({ nextChunkToLoad: 0, paused: false });

  // Removed local key derivation - using EncryptionContext

  const [mediaSourceUrl, setMediaSourceUrl] = useState(null);

  // Ref to store parts metadata for chunk lookups
  const partsRef = useRef([]);
  const totalChunksRef = useRef(0);

  // Ref to track in-flight requests for deduplication
  const fetchingRef = useRef(new Map());
  
  // Ref to track the last time range was removed (for windowing)
  // When chunks are removed, we need to re-fetch them even if they were previously buffered
  const lastRemovedTimeRef = useRef(0);

  // Fetch and decrypt a single chunk from API endpoint
   const fetchAndDecryptChunk = useCallback(async (chunkNum, key, signal) => {
      // Deduplication: Return existing promise if already fetching this chunk
      if (fetchingRef.current.has(chunkNum)) {
          return fetchingRef.current.get(chunkNum);
      }

      const fetchPromise = (async () => {
          try {
              // Find metadata for this chunk
              const part = partsRef.current.find(p => p.part_number === chunkNum);
              if (!part) throw new Error(`Metadata missing for chunk ${chunkNum}`);

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
      // Look for 'moov' box (0x6d6f6f76)
      let moovStart = -1;
      for (let i = 0; i < data.length - 4; i++) {
        if (data[i] === 0x6d && data[i+1] === 0x6f && data[i+2] === 0x6f && data[i+3] === 0x76) {
          moovStart = i;
          break;
        }
      }
      
      if (moovStart === -1) {
        return null;
      }
      
      // Go back 4 bytes to get size
      const moovSize = dv.getUint32(moovStart - 4, false); // big-endian
      const moovEnd = moovStart + moovSize;
      
      if (moovEnd > data.length) {
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
        return null;
      }
      
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
          return null;
        }
        
        timescale = dv.getUint32(timeScaleOffset, false);
        // For 64-bit, just use lower 32 bits (assume duration < 4GB ticks)
        duration = dv.getUint32(durationOffset + 4, false);
      } else {
        return null;
      }
      
      if (timescale === 0) {
        return null;
      }
      
      const durationInSeconds = duration / timescale;
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
        console.error('[appendToSourceBuffer] Error event:', errorMsg);
        reject(new Error(errorMsg));
      };

      sourceBuffer.addEventListener('updateend', onUpdateEnd);
      sourceBuffer.addEventListener('error', onError);

      try {
        sourceBuffer.appendBuffer(data);
      } catch (err) {
        sourceBuffer.removeEventListener('updateend', onUpdateEnd);
        sourceBuffer.removeEventListener('error', onError);
        console.error('[appendToSourceBuffer] Exception during appendBuffer:', err.message);
        reject(err);
      }
    });
  }, []);
  // 1. Use setTimestampOffset() to position chunks at correct timeline location
  // 2. This tells the demuxer where samples belong in the video timeline
  // 3. Without this, chunks 5+ get rejected because timestamps don't align
  // WINDOW: Only fetch chunks in [startChunk, endChunk] range to avoid OOM when seeking into removed regions
  const loadChunksOnDemand = useCallback(async (startChunk, endChunk, key, isFragmented = true) => {
    if (!sourceBufferRef.current || !mediaSourceRef.current) {
      return Promise.resolve();
    }
    
    // Build list of chunks to fetch (never re-append init segment - it's already in buffer)
     const chunksToFetch = [];
     
     // Add requested chunks to fetch list
     for (let i = startChunk; i <= endChunk; i++) {
       chunksToFetch.push(i);
     }
     
     const totalChunksToFetch = chunksToFetch.length;
    // Step 1: Fetch ALL chunks first (prevents out-of-order issues)
     const chunksToAppend = [];
    let fetchedCount = 0;
    // If not, we must fetch it first since init is required for any playback
    const buffered = videoRef.current?.buffered;
    const hasInitInBuffer = buffered && buffered.length > 0 && 0 >= buffered.start(0) && 0 <= buffered.end(buffered.length - 1);
    
    if (!hasInitInBuffer && startChunk > 1) {
      try {
        const { decrypted: initDecrypted } = await fetchAndDecryptChunk(1, key, abortControllerRef.current.signal);
        chunksToAppend.push({ chunkNum: 1, decrypted: initDecrypted });
      } catch (err) {
        console.error(`[VideoPlayer] Failed to fetch init segment (chunk 1):`, err.message);
        throw err;
      }
    }
    
     for (const chunkNum of chunksToFetch) {
        if (abortControllerRef.current?.signal.aborted) {
          return;
        }
        
        try {
          const { decrypted } = await fetchAndDecryptChunk(chunkNum, key, abortControllerRef.current.signal);
          chunksToAppend.push({ chunkNum, decrypted });
          fetchedCount++;
          const loadPercent = Math.round((fetchedCount / totalChunksToFetch) * 100);
          setSeekLoadingPercent(loadPercent);
        } catch (err) {
          console.error(`[VideoPlayer] On-demand fetch failed for chunk ${chunkNum}:`, err.message);
          // Continue fetching remaining chunks
        }
      }
     
     // Step 2: Append all fetched chunks in order
     if (chunksToAppend.length === 0) {
       return;
     }
     // Each chunk nominally represents (duration / totalChunks) seconds
     // If we're appending chunk 5+ with a gap, we need to tell the demuxer where chunk 5's timeline starts
     const secondsPerChunk = mediaSourceRef.current.duration / totalChunksRef.current;
     let offsetApplied = false;
     
     // Check if FIRST chunk in sequence has a gap
     // EXCEPTION: If chunk 1 (init) was re-appended, don't use offset for chunk 2+ as they follow the fresh init
     const firstChunk = chunksToAppend[0]?.chunkNum;
     const hasInitBeenReappended = firstChunk === 1;
     let needsOffset = false;
     if (firstChunk && firstChunk > 2 && isFragmented && !hasInitBeenReappended) {
       const buffered = videoRef.current?.buffered;
       const hasGap = !buffered || buffered.length === 0 || 
                     ((firstChunk / totalChunksRef.current) * mediaSourceRef.current.duration) > 
                     buffered.end(buffered.length - 1);
       needsOffset = hasGap;
     }
     
     for (const { chunkNum, decrypted } of chunksToAppend) {
       if (abortControllerRef.current?.signal.aborted) {
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
         // Set timestampOffset ONCE before appending first gap chunk
         // This offsets ALL samples in the moof/mdat boxes that follow
         if (!offsetApplied && needsOffset && chunkNum > 2) {
           // Chunk 1 = init segment (not in timeline)
           // Chunk 2 = first media (timeline 0s)
           // Chunk N = (N-2) * secondsPerChunk
           const chunkStartTime = (chunkNum - 2) * secondsPerChunk;
           sourceBufferRef.current.timestampOffset = chunkStartTime;
           offsetApplied = true;
         }
         
         await appendToSourceBuffer(sourceBufferRef.current, decrypted);
         setCurrentChunk(chunkNum);
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
     
     // Reset timestamp offset after gap-fill sequence completes
     if (offsetApplied && sourceBufferRef.current) {
       sourceBufferRef.current.timestampOffset = 0;
     }
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

        // For non-fragmented MP4/MOV, download all chunks first
         // MediaSource API only works with fragmented MP4/MOV or WebM
         if (isMP4 && !isFragmented) {
           setPlaybackMode('full-download');
           setFallbackReason('Video not fragmented');
           await loadAllChunks(manifest, key);
           return;
         }

         // For WebM or fragmented MP4/MOV, try MediaSource for progressive playback
          const canUseMediaSource = tryMediaSource(manifest, key, isFragmented);

         if (canUseMediaSource) {
           setUseMediaSource(true);
           setPlaybackMode('progressive');
           return;
         }

         // Fallback: Download and decrypt all chunks
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
        setFallbackReason('MediaSource API unsupported');
        return false;
      }

      // Check codec support
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
          break;
        }
      }

      if (!supportedCodec) {
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

                     // Clean up bad buffer - wait for state to settle
                     if (sourceBuffer.updating) {
                       await new Promise(r => sourceBuffer.addEventListener('updateend', r, { once: true }));
                     }
                     try { 
                       mediaSource.removeSourceBuffer(sourceBuffer); 
                     } catch(e) {
                     }

                     // Create new buffer without audio codec
                     const videoOnlyCodec = supportedCodec.replace(/, mp4a\.40\.2/g, '').replace(/, opus/g, '').replace(/, vorbis/g, '');

                     try {
                       sourceBuffer = mediaSource.addSourceBuffer(videoOnlyCodec);
                       sourceBufferRef.current = sourceBuffer;
                       await appendToSourceBuffer(sourceBuffer, decrypted);
                     } catch (retryErr) {
                       throw new Error('MediaSource recovery failed, falling back to full-download');
                     }
                 } else {
                     throw err; // Re-throw other errors
                 }
            }
            const headerBytes = Array.from(decrypted.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' ');
            let videoDuration = null;
            if (isFragmented) {
              try {
                videoDuration = extractDurationFromMoov(decrypted);
                if (videoDuration && videoDuration > 0) {
                  mediaSource.duration = videoDuration;
                } else {
                  // Fallback: estimate from chunk count + file size
                  // Average chunk is ~2.5MB, typical bitrate for video is ~2Mbps, so ~10 sec per 2.5MB
                  // More conservative: assume ~20-25 sec per chunk for 2-3MB chunks
                  const estimatedDuration = total * 25; // 25 sec per chunk is reasonable for 2-3MB chunks
                  mediaSource.duration = estimatedDuration;
                }
              } catch (e) {
                console.error(`[VideoPlayer] Exception during duration extraction:`, e.message);
                // Fallback: estimate from chunk count (~20-25 sec per 2-3MB chunk)
                const fallbackDuration = total * 25;
                mediaSource.duration = fallbackDuration;
              }
            }
            if (videoRef.current) {
              const buffered = videoRef.current.buffered;
              const ranges = [];
              for(let i=0; i<buffered.length; i++) {
                ranges.push(`[${buffered.start(i).toFixed(2)}s - ${buffered.end(i).toFixed(2)}s]`);
              }
                readyState: videoRef.current.readyState,
                paused: videoRef.current.paused,
                error: videoRef.current.error,
                buffered: ranges.join(', '),
                currentTime: videoRef.current.currentTime
              });
            }

            // For non-fragmented: just load remaining chunks as-is
            if (isFragmented) {
              setCurrentChunk(1);
              const BUFFER_THRESHOLD = config.videoPlaybackBufferThreshold;
              let chunksBuffered = 1; // Already have chunk 1 (init segment)
              for (let i = 2; i <= Math.min(BUFFER_THRESHOLD, total); i++) {
                if (cancelled) {
                  break;
                }

                try {
                  const { decrypted: mediaDecrypted } = await fetchAndDecryptChunk(i, key, abortControllerRef.current.signal);
                  await appendToSourceBuffer(sourceBuffer, mediaDecrypted);
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
              try {
                await videoRef.current.play();
              } catch (e) {
              }
              
              // Continuous background buffer refill
              // Keep 5-10 chunks ahead of playhead, load more as video plays
              const MAX_CHUNKS_AHEAD = 8;
              let nextChunkToLoad = BUFFER_THRESHOLD + 1;
              let allChunksLoaded = false;
              
              backgroundLoaderStateRef.current.nextChunkToLoad = nextChunkToLoad;
              
              const backgroundLoader = setInterval(async () => {
                if (cancelled || allChunksLoaded) {
                  clearInterval(backgroundLoader);
                  return;
                }
                if (backgroundLoaderStateRef.current.paused) {
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
                  
                  // WINDOWING: Remove chunks older than (currentTime - 5 minutes)
                  // This prevents unbounded memory growth while keeping recent chunks for backward seeking
                  const LOOKBACK_WINDOW = 300; // 5 minutes in seconds
                  const removeUpToTime = Math.max(0, currentTime - LOOKBACK_WINDOW);
                  
                  if (removeUpToTime > 0 && buffered.length > 0) {
                    try {
                      // Only remove if sourceBuffer is not updating
                      if (!sourceBuffer.updating) {
                        sourceBuffer.remove(0, removeUpToTime);
                        // Track the removed time range so we know to re-fetch chunks seeking into it
                        lastRemovedTimeRef.current = removeUpToTime;
                      }
                    } catch (removeErr) {
                    }
                  }
                  
                  // If we have less than MAX_CHUNKS_AHEAD, load more
                  if (chunksAhead < MAX_CHUNKS_AHEAD && nextChunkToLoad <= total) {
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
                        } catch (e) {
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
                    } catch (e) {
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
        {/* Loading overlay - only show during initial load, not during seek buffering */}
        {isLoading && !isSeekBuffering && (
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
            // Simple approach: if seeking backward significantly, just ignore it
            // The browser's native seek-within-buffered-range will work fine
            // This avoids complex buffer management that's causing issues
            if (useMediaSource && videoRef.current && sourceBufferRef.current && mediaSourceRef.current) {
              if (videoRef.current.error) {
                console.error(`[VideoPlayer] Video in error state - ignoring seek request: ${videoRef.current.error.message}`);
                return;
              }
              
              const seekTime = videoRef.current.currentTime;
              const buffered = videoRef.current.buffered;
              const totalDuration = mediaSourceRef.current.duration;
              
              // Check if seek target is buffered
              let isBuffered = false;
              for (let i = 0; i < buffered.length; i++) {
                if (seekTime >= buffered.start(i) && seekTime <= buffered.end(i)) {
                  isBuffered = true;
                  return;
                }
              }
              
              // Not buffered - just wait for background loader to catch up
            }
          }}
        />
      </div>

      {/* Seek buffering indicator */}
      {isSeekBuffering && (
        <div className="space-y-1 mb-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex justify-between items-center text-xs text-blue-600">
            <span>⏳ Loading seek position...</span>
            <span className="font-semibold">{seekLoadingPercent}%</span>
          </div>
          <div className="h-2 bg-blue-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-500 transition-all duration-200" 
              style={{ width: `${seekLoadingPercent}%` }} 
            />
          </div>
        </div>
      )}

      {/* Buffering indicator for MediaSource */}
      {!isLoading && useMediaSource && currentChunk < totalChunks && !isSeekBuffering && (
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
