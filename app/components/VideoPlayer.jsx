'use client';

import { useState, useEffect, useRef } from 'react';
import { useEncryption } from '../contexts/EncryptionContext';

/**
 * Streaming Video Player Component
 *
 * Uses server-side streaming with token-based auth.
 * Video element streams directly from /api/stream, allowing browser's
 * native buffering and progressive playback.
 *
 * Key: Video src URL includes token param so browser can request ranges
 * directly without JavaScript intervention.
 */
export default function VideoPlayer({ fileId, fileName, fileSize, mimeType }) {
  const { masterPassword } = useEncryption();
  const [error, setError] = useState(null);
  const [isBuffering, setIsBuffering] = useState(true);
  const [hasStartedPlaying, setHasStartedPlaying] = useState(false);

  const videoRef = useRef(null);

  // Construct the streaming URL with token auth
  const streamUrl = masterPassword
    ? `/api/stream?file_id=${fileId}&token=${encodeURIComponent(masterPassword)}`
    : null;

  // Handle video events
  const handleCanPlay = () => {
    console.log('Video can play - starting playback');
    setIsBuffering(false);
  };

  const handlePlaying = () => {
    console.log('Video is playing');
    setHasStartedPlaying(true);
    setIsBuffering(false);
  };

  const handleWaiting = () => {
    console.log('Video is buffering...');
    if (hasStartedPlaying) {
      setIsBuffering(true);
    }
  };

  const handleError = (e) => {
    console.error('Video error:', e);
    const video = videoRef.current;
    if (video?.error) {
      setError(`Video error: ${video.error.message || 'Unknown error'}`);
    } else {
      setError('Failed to load video');
    }
  };

  const handleLoadedData = () => {
    console.log('Video data loaded');
    setIsBuffering(false);
  };

  // Track buffered amount
  const [bufferedPercent, setBufferedPercent] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateBuffered = () => {
      if (video.buffered.length > 0 && video.duration) {
        const buffered = video.buffered.end(video.buffered.length - 1);
        const percent = (buffered / video.duration) * 100;
        setBufferedPercent(percent);
      }
    };

    video.addEventListener('progress', updateBuffered);
    video.addEventListener('timeupdate', updateBuffered);

    return () => {
      video.removeEventListener('progress', updateBuffered);
      video.removeEventListener('timeupdate', updateBuffered);
    };
  }, []);

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
            onClick={() => {
              setError(null);
              if (videoRef.current) {
                videoRef.current.load();
              }
            }}
            className="mt-2 text-sm underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      <div className="bg-black rounded-lg overflow-hidden relative">
        {/* Buffering indicator overlay */}
        {isBuffering && !error && (
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center z-10 pointer-events-none">
            <div className="animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full mb-3"></div>
            <p className="text-white text-sm">
              {hasStartedPlaying ? 'Buffering...' : 'Loading stream...'}
            </p>
          </div>
        )}

        {/* Video element - streams directly from server */}
        {streamUrl && (
          <video
            ref={videoRef}
            src={streamUrl}
            controls
            autoPlay
            playsInline
            className="w-full bg-black"
            style={{ maxHeight: '600px' }}
            onCanPlay={handleCanPlay}
            onPlaying={handlePlaying}
            onWaiting={handleWaiting}
            onError={handleError}
            onLoadedData={handleLoadedData}
          />
        )}
      </div>

      {/* Buffer progress bar */}
      {!error && bufferedPercent > 0 && bufferedPercent < 99 && (
        <div className="space-y-1">
          <div className="flex justify-between items-center text-xs text-gray-500">
            <span>Buffered</span>
            <span>{Math.round(bufferedPercent)}%</span>
          </div>
          <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all duration-300"
              style={{ width: `${bufferedPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Info */}
      <div className="text-sm text-gray-600">
        <p className="truncate">{fileName}</p>
        <p className="text-xs text-gray-500">
          {(fileSize / 1024 / 1024).toFixed(1)} MB
          {isBuffering && !hasStartedPlaying && ' • Connecting to stream...'}
        </p>
      </div>
    </div>
  );
}
