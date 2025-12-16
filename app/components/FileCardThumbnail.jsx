'use client';

import { getFileExtension } from '@/lib/utils';

import SecureImage from './SecureImage';

export default function FileCardThumbnail({ file, className = "" }) {
  const fileExt = getFileExtension(file.original_filename);
  const isImage = file.mime_type?.startsWith('image/');

  return (
    <div className={`bg-gray-100 flex items-center justify-center w-full h-full ${className}`}>
      {isImage ? (
        <SecureImage
          file={file}
          className="w-full h-full object-cover animate-fade-in"
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-lg">
          {fileExt ? fileExt.charAt(0).toUpperCase() : '📄'}
        </div>
      )}
    </div>
  );
}
