'use client';

import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';

export default function PreviewModal({ file, isOpen, onClose }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!isOpen || !mounted) return null;

  const isImage = file?.mime_type?.startsWith('image/');
  const isVideo = file?.mime_type?.startsWith('video/');
  const isAudio = file?.mime_type?.startsWith('audio/');

  const fileUrl = `/api/download?file_id=${file.id}`;

  const modalContent = (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[9999] p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-lg max-w-4xl w-full max-h-[90vh] overflow-auto animate-fade-in" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex justify-between items-center z-10">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 truncate">
              {file?.original_filename}
            </h3>
            <p className="text-sm text-gray-500">
              {(file?.file_size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-bold p-2"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-8 flex items-center justify-center min-h-[400px] bg-gray-50">
           {isImage && (
             <div className="flex justify-center">
               <img
                 src={fileUrl}
                 alt={file.original_filename}
                 className="max-w-full max-h-[70vh] rounded shadow-sm object-contain"
               />
             </div>
           )}

           {isVideo && (
             <div className="flex justify-center">
               <video
                 src={fileUrl}
                 controls
                 autoPlay
                 className="max-w-full max-h-[70vh] rounded shadow-sm"
               >
                 Your browser does not support the video tag.
               </video>
             </div>
           )}

           {isAudio && (
             <div className="flex flex-col items-center gap-4 p-8 bg-white rounded-xl shadow-sm">
               <div className="text-6xl animate-bounce">🎵</div>
               <audio
                 src={fileUrl}
                 controls
                 autoPlay
                 className="w-full max-w-md"
               />
             </div>
           )}

           {!isImage && !isVideo && !isAudio && (
             <div className="text-center p-8 bg-white rounded-xl shadow-sm">
               <p className="text-6xl mb-4">📄</p>
               <p className="text-gray-600 mb-4 font-medium">
                 Preview not available for this file type
               </p>
               <a
                 href={fileUrl}
                 download={file.original_filename}
                 className="bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 inline-flex items-center gap-2 transition shadow"
               >
                 <span>Download File</span>
               </a>
             </div>
           )}
        </div>

        {/* Footer */}
        {file?.description && (
          <div className="border-t border-gray-200 p-4 bg-gray-50">
            <h4 className="font-semibold text-gray-900 mb-2">Description</h4>
            <p className="text-gray-700">{file.description}</p>
          </div>
        )}

        {file?.tags && (
          <div className="border-t border-gray-200 p-4 bg-gray-50">
            <h4 className="font-semibold text-gray-900 mb-2">Tags</h4>
            <div className="flex flex-wrap gap-2">
              {file.tags.split(',').map((tag, idx) => (
                <span
                  key={idx}
                  className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm"
                >
                  {tag.trim()}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="border-t border-gray-200 p-4 bg-gray-50 flex gap-2">
          <a
            href={fileUrl}
            download={file.original_filename}
            className="flex-1 bg-blue-600 text-white text-center px-4 py-2 rounded hover:bg-blue-700 transition"
          >
            Download
          </a>
          <button
            onClick={onClose}
            className="flex-1 bg-gray-300 text-gray-900 px-4 py-2 rounded hover:bg-gray-400 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
