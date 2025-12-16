
'use client';

import { useState, useEffect, useRef } from 'react';

import { useEncryption } from '../contexts/EncryptionContext';

export default function UploadForm({ onFileUploaded, currentFolderId, externalFiles }) {
  const { masterPassword, isUnlocked, unlock } = useEncryption();
  const [queue, setQueue] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isEncrypted, setIsEncrypted] = useState(true); // Default to true
  // Local state for password input if vault is locked
  const [inputPassword, setInputPassword] = useState('');
  const fileInputRef = useRef(null);

  // Handle external files (e.g. from global DropZone)
  useEffect(() => {
    if (externalFiles && externalFiles.length > 0) {
      addFilesToQueue(externalFiles);
    }
  }, [externalFiles]);

  const addFilesToQueue = (fileList) => {
    const newFiles = Array.from(fileList).map(file => ({
      file,
      id: Math.random().toString(36).substr(2, 9),
      status: 'pending', // pending, uploading, success, error
      progress: 0,
      error: null
    }));

    setQueue(prev => [...prev, ...newFiles]);
  };

  // Process queue
  useEffect(() => {
    const processQueue = async () => {
      const pendingFile = queue.find(f => f.status === 'pending');
      if (!pendingFile) return;

      if (isEncrypted && !isUnlocked && !inputPassword) {
         updateFileStatus(pendingFile.id, 'error', 0, 'Unlock vault required');
         return;
      }

      // If valid password provided but not unlocked yet, unlock it now (optimistic)
      let activePassword = masterPassword;
      if (isEncrypted && !isUnlocked && inputPassword) {
          activePassword = inputPassword;
          // We could verify it first, but for now we assume it's correct and let upload verify
          unlock(inputPassword);
      }

      // Update status to uploading
      updateFileStatus(pendingFile.id, 'uploading', 0);

      try {
        const formData = new FormData();
        formData.append('file', pendingFile.file);
        if (currentFolderId) formData.append('folder_id', currentFolderId);
        if (isEncrypted) formData.append('master_password', activePassword);

        // Simulate progress (since fetch doesn't support generic progress events easily)
        const progressInterval = setInterval(() => {
             updateFileStatus(pendingFile.id, 'uploading', Math.random() * 30 + 50); // Fake progress to 50-80%
        }, 500);

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        clearInterval(progressInterval);

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Upload failed');
        }

        updateFileStatus(pendingFile.id, 'success', 100);
        if (onFileUploaded) onFileUploaded();

        // Remove from queue after 3 seconds
        setTimeout(() => {
            setQueue(prev => prev.filter(f => f.id !== pendingFile.id));
        }, 3000);

      } catch (err) {
        updateFileStatus(pendingFile.id, 'error', 0, err.message);
      }
    };

    if (queue.some(f => f.status === 'pending') && !queue.some(f => f.status === 'uploading')) {
       processQueue();
    }
  }, [queue, currentFolderId, onFileUploaded, isEncrypted, isUnlocked, inputPassword, masterPassword, unlock]);

  const updateFileStatus = (id, status, progress, error = null) => {
    setQueue(prev => prev.map(f => {
      if (f.id === id) {
        return { ...f, status, progress, error };
      }
      return f;
    }));
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.target.id === 'drop-zone') { // Ensure we only leave if we leave the zone itself
        setIsDragging(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFilesToQueue(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      addFilesToQueue(e.target.files);
    }
    // Reset input so same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-4">
      <div
        id="drop-zone"
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer relative overflow-hidden ${
          isDragging
            ? 'border-blue-500 bg-blue-50 scale-[1.01]'
            : 'border-gray-200 hover:border-blue-400 hover:bg-gray-50'
        }`}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          multiple
          className="hidden"
        />

        <div className="space-y-2 pointer-events-none">
          <div className={`text-4xl transition-transform duration-300 ${isDragging ? 'scale-125 bounce' : ''}`}>
             {isDragging ? '📂' : '📤'}
          </div>
          <p className="font-medium text-gray-700">
            {isDragging ? 'Drop files here' : 'Click or Drag files to upload'}
          </p>
          <p className="text-sm text-gray-500">
            Supports multiple files (Max 100MB each)
          </p>
        </div>
      </div>

      {/* Master Password Input Removed (Server-side key handled) */}
      {/* Security Info / Unlock Prompt */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
         {isEncrypted ? (
             isUnlocked ? (
                 <div className="flex items-center text-green-600 text-sm font-medium">
                     <span className="mr-2">🔓</span> Vault Unlocked (Session Active)
                 </div>
             ) : (
                <div className="animate-fade-in">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Unlock Vault to Upload
                    </label>
                    <input
                        type="password"
                        placeholder="Enter Master Password"
                        value={inputPassword}
                        onChange={(e) => setInputPassword(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                     <div className="flex items-center text-blue-600 text-xs mt-1">
                        <span className="mr-1">🔒</span> Files will be encrypted with this password.
                    </div>
                </div>
             )
         ) : (
             <p className="text-gray-500 text-sm">Standard unencrypted upload.</p>
         )}
      </div>

      {/* Queue List */}
      {queue.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden divide-y divide-gray-100">
          {queue.map((item) => (
            <div key={item.id} className="p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-sm">
                {item.status === 'success' ? '✅' : item.status === 'error' ? '❌' : '📄'}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-1">
                  <p className="text-sm font-medium text-gray-700 truncate">{item.file.name}</p>
                  <span className={`text-xs font-semibold ${
                      item.status === 'success' ? 'text-green-600' :
                      item.status === 'error' ? 'text-red-600' :
                      'text-blue-600'
                  }`}>
                    {item.status === 'success' ? 'Completed' :
                     item.status === 'error' ? 'Failed' :
                     item.status === 'uploading' ? 'Uploading...' : 'Pending'}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 rounded-full ${
                        item.status === 'success' ? 'bg-green-500' :
                        item.status === 'error' ? 'bg-red-500' :
                        'bg-blue-500'
                    }`}
                    style={{ width: `${item.status === 'success' ? 100 : item.status === 'error' ? 100 : item.progress}%` }}
                  />
                </div>

                {item.error && (
                  <p className="text-xs text-red-500 mt-1">{item.error}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
