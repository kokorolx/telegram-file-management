'use client';

/**
 * MP4 Video Fragmentation Utility
 *
 * Fragments MP4 files for progressive playback using ffmpeg.wasm
 * Supports multi-threading when SharedArrayBuffer is available
 */

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import { isFfmpegMultiThreadEnabled } from './featureFlags';

let ffmpegInstance = null;
let isMultiThreadSupported = null;
let isInitializing = false;

/**
 * Check if multi-threading is supported in the current browser
 * Requires SharedArrayBuffer which needs COOP/COEP headers
 *
 * @returns {boolean} true if multi-threading is supported
 */
function checkMultiThreadSupport() {
  if (isMultiThreadSupported !== null) return isMultiThreadSupported;

  try {
    // Check for SharedArrayBuffer
    isMultiThreadSupported = typeof SharedArrayBuffer !== 'undefined';
  } catch {
    isMultiThreadSupported = false;
  }

  return isMultiThreadSupported;
}

/**
 * Initialize ffmpeg instance with multi-threading if available
 * Uses CDN-hosted ffmpeg.wasm binaries
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
      const useMultiThread = checkMultiThreadSupport() && isFfmpegMultiThreadEnabled();
      const coreType = useMultiThread ? '-mt' : '';
      const baseURL = `https://unpkg.com/@ffmpeg/core${coreType}@0.12.6/dist/umd`;

      console.log('[VideoFragmentation] Loading FFmpeg core...');
      await ffmpegInstance.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        ...(useMultiThread && {
          workerURL: await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, 'text/javascript')
        })
      });

      console.log(`[VideoFragmentation] FFmpeg loaded with ${useMultiThread ? 'multi-threading' : 'single-threading'}`);
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
 * @returns {Promise<Blob>} Fragmented MP4 blob
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

    // Fragment the MP4
    console.log(`[VideoFragmentation] Starting fragmentation for ${file.name} with movflags: frag_keyframe+empty_moov+default_base_moof`);
    await ffmpeg.exec([
      '-i', 'input.mp4',
      '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
      // Max compatibility: Re-encode to H.264 Baseline + AAC
      // This is slower but guarantees it plays on almost all browsers/MSE
      '-c:v', 'libx264',
      '-profile:v', 'baseline',
      '-level', '3.0',
      '-preset', 'ultrafast', // Speed over compression efficiency for client-side
      // '-crf' removed to avoid potential WASM conflicts in multi-threaded mode
      '-c:a', 'aac',
      '-ar', '44100',
      '-b:a', '128k',
      'output.mp4'
    ]);

    // Read output
    const data = await ffmpeg.readFile('output.mp4');
    console.log(`[VideoFragmentation] Fragmentation complete for ${file.name}. Output size: ${data.length} bytes. Ratio: ${(data.length / inputData.length).toFixed(4)}`);

    // Cleanup
    await ffmpeg.deleteFile('input.mp4');
    await ffmpeg.deleteFile('output.mp4');

    onProgress(100);

    return new Blob([data.buffer], { type: 'video/mp4' });
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
  const multiThreadSupport = checkMultiThreadSupport();
  const multiThreadEnabled = isFfmpegMultiThreadEnabled();

  return {
    supported: isFragmentationSupported(),
    multiThreadSupported: multiThreadSupport,
    multiThreadEnabled: multiThreadEnabled,
    mode: (multiThreadSupport && multiThreadEnabled) ? 'multi-threaded' : 'single-threaded',
    reason: !multiThreadSupport ? 'SharedArrayBuffer not available' :
            !multiThreadEnabled ? 'Multi-threading disabled in config' :
            'Ready'
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
