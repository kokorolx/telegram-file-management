export function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

export function getFileExtension(filename) {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) return '';
  return filename.substring(lastDot + 1).toLowerCase();
}

export function getMimeType(extension) {
  const mimeTypes = {
    // Documents
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    txt: 'text/plain',
    // Images
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    webp: 'image/webp',
    // Audio
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    m4a: 'audio/mp4',
    aac: 'audio/aac',
    flac: 'audio/flac',
    // Video
    mp4: 'video/mp4',
    webm: 'video/webm',
    mkv: 'video/x-matroska',
    avi: 'video/x-msvideo',
    mov: 'video/quicktime',
    flv: 'video/x-flv',
    wmv: 'video/x-ms-wmv',
    m4v: 'video/mp4',
    // Archives
    zip: 'application/zip',
    rar: 'application/x-rar-compressed',
    '7z': 'application/x-7z-compressed',
  };
  return mimeTypes[extension] || 'application/octet-stream';
}

export function isVideoFile(filename) {
  const videoExtensions = ['mp4', 'webm', 'mkv', 'avi', 'mov', 'flv', 'wmv', 'm4v', 'ts', 'mts', 'm2ts'];
  const ext = getFileExtension(filename).toLowerCase();
  return videoExtensions.includes(ext);
}

export function isAudioFile(filename) {
  const audioExtensions = ['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg', 'wma', 'opus'];
  const ext = getFileExtension(filename).toLowerCase();
  return audioExtensions.includes(ext);
}

export function validateFile(file) {
  if (!file) {
    return { valid: false, error: 'No file provided' };
  }

  const isVideo = isVideoFile(file.name);
  const isAudio = isAudioFile(file.name);
  
  // Max file sizes: 500MB for videos, 100MB for others
  const maxSize = (isVideo || isAudio) ? 500 * 1024 * 1024 : 100 * 1024 * 1024;
  
  if (file.size > maxSize) {
    const sizeMB = Math.round(maxSize / 1024 / 1024);
    return { valid: false, error: `File too large. Max size: ${sizeMB}MB` };
  }

  return { valid: true };
}
