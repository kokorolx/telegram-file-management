'use client';

import { useState, useEffect } from 'react';
import VideoPlayer from './VideoPlayer';
import { useEncryption } from '../contexts/EncryptionContext';

export default function FileViewer({ file, onClose }) {
  const { masterPassword, isUnlocked } = useEncryption();
  const [passwordPrompt, setPasswordPrompt] = useState(!isUnlocked);

  if (!file) return null;

  const isVideo = file.mime_type?.startsWith('video/');
  console.log('🚀🚀🚀 ====== isVideo:', isVideo)
  const fileName = file.original_filename;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="text-lg font-semibold truncate">{fileName}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 font-semibold text-2xl"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {isVideo ? (
            <>
              <p className="text-sm text-gray-600">Video File</p>
              {masterPassword && isUnlocked ? (
                <VideoPlayer
                  fileId={file.id}
                  fileName={fileName}
                  fileSize={file.file_size}
                  mimeType={file.mime_type}
                />
              ) : (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                  <p className="text-blue-700">Please unlock with your master password to view video.</p>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-600">📄 {fileName}</p>
              <p className="text-sm text-gray-500 mt-2">
                Size: {(file.file_size / 1024 / 1024).toFixed(2)} MB
              </p>
              {file.is_encrypted && (
                <p className="text-sm text-green-600 mt-1">🔐 Encrypted with AES-256-GCM</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-4 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
