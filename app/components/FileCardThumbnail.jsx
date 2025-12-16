'use client';

import { getFileExtension } from '@/lib/utils';

export default function FileCardThumbnail({ file }) {
  const fileExt = getFileExtension(file.original_filename);
  const isImage = file.mime_type?.startsWith('image/');
  const imageUrl = `/api/download?file_id=${file.id}`;

  return (
    <div className="mb-2 h-20 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
      {isImage ? (
        <img
          src={imageUrl}
          alt={file.original_filename}
          className="w-full h-full object-cover animate-fade-in"
          loading="lazy"
          onError={(e) => {
            e.target.onerror = null;
            e.target.style.display = 'none';
            e.target.parentNode.innerHTML = '<div class="text-xs text-gray-400">Error</div>';
          }}
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-lg">
          {fileExt ? fileExt.charAt(0).toUpperCase() : '📄'}
        </div>
      )}
    </div>
  );
}
