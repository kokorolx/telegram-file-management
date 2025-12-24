'use client';

/**
 * MP4 Video Fragmentation Utility
 *
 * Fragments MP4 files for progressive playback using ffmpeg.wasm (codec-copy, single-threaded)
 * Uses container manipulation only - no re-encoding, so multi-threading not needed
 */

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

let ffmpegInstance = null;
let isInitializing = false;

/**
 * Initialize ffmpeg instance
 * Uses CDN-hosted ffmpeg.wasm binaries (single-threaded)
 *
 * @returns {Promise<FFmpeg>} Initialized FFmpeg instance
 */
async function getFFmpeg() {
  // If instance exists and is loaded, return it immediately
  if (ffmpegInstance && ffmpegInstance.loaded) return ffmpegInstance;

  // Prevent multiple simultaneous initializations
  if (isInitializing) {
    // Wait for initialization to complete
    while (isInitializing) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    // Re-check after waiting
    if (ffmpegInstance && ffmpegInstance.loaded) return ffmpegInstance;
  }

  isInitializing = true;

  try {
    // Re-create instance if it doesn't exist
    if (!ffmpegInstance) {
      ffmpegInstance = new FFmpeg();
    }

    // Only call load() if not already loaded
    if (!ffmpegInstance.loaded) {
      // Use single-threaded core - codec-copy fragmentation is I/O bound, not CPU bound
      // Multi-threading adds complexity (SharedArrayBuffer, COOP/COEP) with zero benefit for codec-copy
      const baseURL = `https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd`;

      console.log('[VideoFragmentation] Loading FFmpeg core (single-threaded)...');
      await ffmpegInstance.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm')
      });

      console.log('[VideoFragmentation] FFmpeg loaded successfully');
    }

    return ffmpegInstance;
  } catch (error) {
    console.error('[VideoFragmentation] Failed to initialize FFmpeg:', error);
    // Only nullify if it was a fatal error preventing future usage
    // But keep it null to retry next time
    ffmpegInstance = null;
    throw new Error(`FFmpeg initialization failed: ${error.message}`);
  } finally {
    isInitializing = false;
  }
}

/**
 * Fragment MP4 file for progressive playback
 * Converts standard MP4 to fragmented MP4 (fMP4) which enables:
 * - Progressive playback via MediaSource API
 * - Seeking without full download
 * - Better streaming performance
 *
 * @param {File} file - Input MP4 file
 * @param {Function} onProgress - Progress callback (0-100)
 * @returns {Promise<{blob: Blob, duration: number|null}>} Fragmented MP4 blob and duration in seconds
 */
export async function fragmentMP4(file, onProgress = () => {}) {
  if (!file) {
    throw new Error('No file provided for fragmentation');
  }

  // Check for MP4 or MOV files
  const isMp4 = file.type.includes('video/mp4') || file.name.toLowerCase().endsWith('.mp4');
  const isMov = file.type.includes('video/quicktime') || file.name.toLowerCase().endsWith('.mov');

  if (!isMp4 && !isMov) {
    throw new Error('Only MP4 and MOV files can be fragmented');
  }

  try {
     const ffmpeg = await getFFmpeg();

     // Set up progress listener
     let lastProgress = 0;
     ffmpeg.on('progress', ({ progress }) => {
       const currentProgress = Math.round(progress * 100);
       if (currentProgress !== lastProgress) {
         lastProgress = currentProgress;
         onProgress(currentProgress);
       }
     });

     // Write input file
     const inputData = new Uint8Array(await file.arrayBuffer());
     console.log(`[VideoFragmentation] Input file size: ${inputData.length} bytes for ${file.name}`);
     await ffmpeg.writeFile('input.mp4', inputData);
     
     // Note: Duration extraction via FFmpeg is disabled due to ArrayBuffer detachment issues
     // The duration will be estimated on the client side during playback
     // For accurate duration, implement server-side extraction using ffprobe
     let videoDuration = null;

    // Fragment the MP4 for MediaSource API compatibility
    // Use movflags for DASH/MSE:
    // - frag_keyframe: new fragment on each keyframe
    // - empty_moov: empty initial moov (required for streaming)
    // - default_base_moof: moof before each mdat segment
    // This creates proper CMAF-compatible init + media segments
    console.log(`[VideoFragmentation] Starting fragmentation for ${file.name} with movflags: frag_keyframe+empty_moov+default_base_moof+dash`);
    
    // Use stream copy (codec copy) to avoid memory overhead
    // Only copies container structure, no re-encoding of video/audio
    await ffmpeg.exec([
      '-i', 'input.mp4',
      '-movflags', 'frag_keyframe+empty_moov+default_base_moof+dash',
      '-c:v', 'copy',  // Copy video stream as-is
      '-c:a', 'copy',  // Copy audio stream as-is
      'output.mp4'
    ]);
    console.log('[VideoFragmentation] Codec copy fragmentation completed');

    // Read output
    const data = await ffmpeg.readFile('output.mp4');
    console.log(`[VideoFragmentation] Fragmentation complete for ${file.name}. Output size: ${data.length} bytes. Ratio: ${(data.length / inputData.length).toFixed(4)}`);

    // Cleanup: Remove temp files from FFmpeg filesystem to free memory
    try {
      await ffmpeg.deleteFile('input.mp4');
      console.log('[VideoFragmentation] Cleaned up input.mp4 from FFmpeg FS');
    } catch (e) {
      console.warn('[VideoFragmentation] Failed to delete input.mp4:', e);
    }
    
    try {
      await ffmpeg.deleteFile('output.mp4');
      console.log('[VideoFragmentation] Cleaned up output.mp4 from FFmpeg FS');
    } catch (e) {
      console.warn('[VideoFragmentation] Failed to delete output.mp4:', e);
    }

    onProgress(100);

    return {
      blob: new Blob([data.buffer], { type: 'video/mp4' }),
      duration: videoDuration
    };
  } catch (error) {
    console.error('[VideoFragmentation] Fragmentation failed:', error);
    throw new Error(`Fragmentation failed: ${error.message}`);
  }
}

/**
 * Check if MP4 fragmentation is supported in current browser
 * Requires WebAssembly and basic Web APIs
 *
 * @returns {boolean} true if fragmentation is supported
 */
export function isFragmentationSupported() {
  // Check for required Web APIs
  return typeof WebAssembly !== 'undefined' &&
         typeof Blob !== 'undefined' &&
         typeof FileReader !== 'undefined';
}

/**
 * Get fragmentation capability information
 * Useful for displaying capability status to users
 *
 * @returns {object} Capability information
 */
export function getFragmentationInfo() {
  return {
    supported: isFragmentationSupported(),
    mode: 'single-threaded',
    reason: isFragmentationSupported() ? 'Ready' : 'WebAssembly not available'
  };
}

/**
 * Cleanup FFmpeg instance
 * Call this when unmounting components or finishing batch operations
 */
export function cleanupFFmpeg() {
  if (ffmpegInstance) {
    // FFmpeg.wasm doesn't have explicit cleanup, just null the reference
    ffmpegInstance = null;
    console.log('[VideoFragmentation] FFmpeg instance cleaned up');
  }
}
