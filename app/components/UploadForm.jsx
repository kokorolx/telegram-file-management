'use client';
import { useState, useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from 'react';

import { useEncryption } from '../contexts/EncryptionContext';
import PasswordPromptModal from './PasswordPromptModal';
import { encryptFileChunks } from '@/lib/browserUploadEncryption';

const UploadForm = forwardRef(({ onFileUploaded, currentFolderId, externalFiles, hideDropZone = false }, ref) => {
  const { masterPassword, isUnlocked, unlock } = useEncryption();
  const [queue, setQueue] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const isEncrypted = true; // Always use browser-side encryption
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);
  const [pendingFileForUpload, setPendingFileForUpload] = useState(null);
  const [customFileName, setCustomFileName] = useState('');
  const fileInputRef = useRef(null);
  const abortControllersRef = useRef(new Map()); // Track abort controllers per file
  const MAX_CONCURRENT_FILES = 3;

  // Expose file input to parent
  useImperativeHandle(ref, () => ({
    openFilePicker: () => {
      fileInputRef.current?.click();
    }
  }));

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
      error: null,
      progressStage: '', // 'Encrypting chunk X/Y', 'Uploading chunk X/Y', etc
      startTime: null, // Track when upload starts
      uploadStartTime: null, // Track when actual upload (not encryption) starts
      estimatedTimeRemaining: null, // ETA in seconds
    }));

    newFiles.forEach(f => {
      console.log(`[UPLOAD] Added to queue: ${f.file.name} (${(f.file.size / 1024 / 1024).toFixed(2)}MB) - ID: ${f.id}`);
    });

    setQueue(prev => [...prev, ...newFiles]);
  };

  // Handle password verification for upload
  const handlePasswordSubmit = async (password) => {
    console.log(`[UPLOAD] Password verification started for file: ${pendingFileForUpload?.file?.name}`);
    setIsVerifyingPassword(true);
    try {
      const response = await fetch('/api/auth/verify-master', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        console.error('[UPLOAD] Password verification failed');
        throw new Error('Invalid master password');
      }

      console.log(`[UPLOAD] ✓ Password verified successfully`);
      // Password verified, proceed with upload
      setShowPasswordPrompt(false);
      setIsVerifyingPassword(false);

      // Continue with the file that was waiting
      if (pendingFileForUpload) {
        console.log(`[UPLOAD] Starting file upload: ${pendingFileForUpload.file.name}`);
        setPendingFileForUpload(null);
        uploadFile(pendingFileForUpload, password);
      }
    } catch (err) {
      console.error(`[UPLOAD] Password verification error:`, err.message);
      setIsVerifyingPassword(false);
      throw err;
    }
  };

  const cancelUpload = async (fileId) => {
    console.log(`[UPLOAD] ${fileId} - Cancel requested`);

    // Abort any ongoing fetch requests
    const abortController = abortControllersRef.current.get(fileId);
    if (abortController) {
      abortController.abort();
      abortControllersRef.current.delete(fileId);
    }

    // Remove from queue
    setQueue(prev => prev.filter(f => f.id !== fileId));
    console.log(`[UPLOAD] ${fileId} - Cancelled and removed from queue`);
  };


  const updateFileStatus = useCallback((id, status, progress, error = null, stage = '', estimatedTimeRemaining = null) => {
    setQueue(prev => prev.map(f => {
      if (f.id === id) {
        return { ...f, status, progress, error, progressStage: stage, estimatedTimeRemaining };
      }
      return f;
    }));
  }, []);

  // Helper to format seconds to human-readable time
  const formatTimeRemaining = (seconds) => {
    if (!seconds || seconds < 0) return '';
    if (seconds < 60) return `${Math.ceil(seconds)}s`;
    if (seconds < 3600) return `${Math.ceil(seconds / 60)}m`;
    return `${Math.ceil(seconds / 3600)}h`;
  };

  // Calculate ETA based on upload speed (not total time which includes encryption)
  const calculateETA = (fileSize, progress, uploadStartTime, stage) => {
    if (!uploadStartTime || progress <= 0 || progress >= 100) return null;
    
    // Only calculate ETA once we're in uploading phase (not encrypting)
    const isUploadingPhase = stage && stage.toLowerCase().includes('uploading');
    if (!isUploadingPhase) return null;
    
    const elapsedMs = Date.now() - uploadStartTime;
    const elapsedSeconds = elapsedMs / 1000;
    
    // Don't estimate if upload just started (less than 0.5 seconds)
    if (elapsedSeconds < 0.5) return null;
    
    const bytesUploaded = (fileSize * progress) / 100;
    const bytesPerSecond = bytesUploaded / elapsedSeconds;
    
    if (bytesPerSecond <= 0) return null;
    
    const remainingBytes = fileSize - bytesUploaded;
    const estimatedSeconds = remainingBytes / bytesPerSecond;
    
    return estimatedSeconds;
  };

  const uploadFile = useCallback(async (fileItem, password) => {
     // const startTime = Date.now();
     console.log(`[UPLOAD] ${fileItem.id} - Starting upload: ${fileItem.file.name}`);
     console.log(`[UPLOAD] ${fileItem.id} - Password provided: ${password ? 'YES' : 'NO'}`);
     console.log(`[UPLOAD] ${fileItem.id} - isEncrypted: ${isEncrypted}`);

     // Create abort controller for this upload
     const abortController = new AbortController();
     abortControllersRef.current.set(fileItem.id, abortController);

     // Update status to uploading and record start time
     const uploadStartTime = Date.now();
     setQueue(prev => prev.map(f => 
       f.id === fileItem.id ? { ...f, startTime: uploadStartTime } : f
     ));
     updateFileStatus(fileItem.id, 'uploading', 0);

    try {
      // NEW: Check for resumable upload
      console.log(`[UPLOAD] ${fileItem.id} - Checking for existing upload...`);
      const checkRes = await fetch(
        `/api/upload/check?filename=${encodeURIComponent(fileItem.file.name)}&size=${fileItem.file.size}`,
        { signal: abortController.signal }
      );
      const checkData = await checkRes.json();

      let fileId = null;
      let resumeFrom = 1;
      let isResume = false;

      let chunkPlan = null;
      
      if (checkData.exists && checkData.can_resume) {
        fileId = checkData.file_id;
        resumeFrom = Math.min(...checkData.missing_chunks);
        isResume = true;
        console.log(`[UPLOAD] ${fileItem.id} - ✓ Resume available: chunks ${resumeFrom}-${checkData.total_chunks}`);
        
        // Retrieve the saved chunk plan from server
        console.log(`[UPLOAD] ${fileItem.id} - Retrieving chunk plan...`);
        const chunkPlanRes = await fetch(
          `/api/upload/chunk-plan?file_id=${fileId}`,
          { signal: abortController.signal }
        );
        if (chunkPlanRes.ok) {
          const chunkPlanData = await chunkPlanRes.json();
          chunkPlan = chunkPlanData.chunk_sizes;
          console.log(`[UPLOAD] ${fileItem.id} - ✓ Retrieved chunk plan: ${chunkPlan.length} chunks`);
        }
        
        updateFileStatus(
          fileItem.id,
          'uploading',
          (resumeFrom / checkData.total_chunks) * 100,
          null,
          `Resuming from chunk ${resumeFrom}/${checkData.total_chunks}`
        );
      } else if (checkData.exists) {
        console.log(`[UPLOAD] ${fileItem.id} - Upload exists but already complete`);
        updateFileStatus(fileItem.id, 'error', 0, 'File already uploaded');
        return;
      }

      // If encrypted upload, use browser-side encryption
        try {
          await encryptFileChunks(
            fileItem.file,
            password,
            (partNumber, totalParts, stage) => {
              // Calculate progress as percentage
              // If resuming, account for already-uploaded chunks
              const progress = isResume 
                ? ((resumeFrom - 1 + partNumber) / totalParts) * 100
                : (partNumber / totalParts) * 100;
              
              // Detect when uploading phase starts and set uploadStartTime
              const fileItem_ = queue.find(f => f.id === fileItem.id);
              const isNowUploading = stage && stage.toLowerCase().includes('uploading');
              
              if (isNowUploading && !fileItem_?.uploadStartTime) {
                setQueue(prev => prev.map(f => 
                  f.id === fileItem.id ? { ...f, uploadStartTime: Date.now() } : f
                ));
              }
              
              // Calculate ETA based on upload speed
              const eta = calculateETA(fileItem.file.size, progress, fileItem_?.uploadStartTime, stage);
              
              updateFileStatus(fileItem.id, 'uploading', progress, null, stage, eta);
              console.log(`[UPLOAD] ${fileItem.id} - ${stage} (${partNumber}/${totalParts})`);
            },
            currentFolderId,
            abortController.signal,
            fileId,        // Pass file_id for resume
            resumeFrom,    // Pass resume starting point
            chunkPlan      // Pass saved chunk sizes for resume
          );

          console.log(`[UPLOAD] ${fileItem.id} - ✓ Encrypted upload successful${isResume ? ' (resumed)' : ''}`);
          updateFileStatus(fileItem.id, 'success', 100);
        } catch (encErr) {
          console.error(`[UPLOAD] ${fileItem.id} - Encryption failed:`, encErr);
          throw new Error(`Encryption failed: ${encErr.message}`);
        }

      if (onFileUploaded) onFileUploaded();

      // Remove from queue after completion
      setTimeout(() => {
        setQueue(prev => prev.filter(f => f.id !== fileItem.id));
      }, 5000);
    } catch (err) {
      // Check if it was a user cancellation
      if (err.message.includes('cancelled') || err.message.includes('Abort')) {
        console.log(`[UPLOAD] ${fileItem.id} - Cancelled by user`);
        // Already removed from queue by cancelUpload
      } else {
        console.error(`[UPLOAD] ${fileItem.id} - FAILED:`, err.message);
        updateFileStatus(fileItem.id, 'error', 0, err.message);
      }
    }
  }, [currentFolderId, onFileUploaded, updateFileStatus]);

  // Process queue
  useEffect(() => {
    const processQueue = async () => {
      const uploadingCount = queue.filter(f => f.status === 'uploading').length;
      if (uploadingCount >= MAX_CONCURRENT_FILES) return;

      const pendingFiles = queue.filter(f => f.status === 'pending');
      if (pendingFiles.length === 0) return;

      // Process up to the concurrency limit
      const itemsToStart = pendingFiles.slice(0, MAX_CONCURRENT_FILES - uploadingCount);

      for (const pendingFile of itemsToStart) {
        // All files must be encrypted
        if (isUnlocked && masterPassword) {
          // User already unlocked - use the master password automatically
          console.log(`[UPLOAD] User unlocked - using master password automatically for ${pendingFile.file.name}`);
          uploadFile(pendingFile, masterPassword);
        } else if (!showPasswordPrompt) {
          // User not unlocked - show password prompt to unlock
          console.log(`[UPLOAD] User not unlocked - showing password prompt for ${pendingFile.file.name}`);
          setPendingFileForUpload(pendingFile);
          setShowPasswordPrompt(true);
          // Only show prompt for the first one, others will wait
          break;
        }
      }
    };

    if (queue.some(f => f.status === 'pending')) {
      processQueue();
    }
  }, [queue, isUnlocked, masterPassword, showPasswordPrompt, uploadFile]);

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.target.id === 'drop-zone') {
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
    <>
      <div className="space-y-4">
        {/* Hidden File Input for programmatic use */}
        <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            multiple
            className="hidden"
        />

        {!hideDropZone && (
            <>
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
                <div className="space-y-2 pointer-events-none">
                    <div className={`text-4xl transition-transform duration-300 ${isDragging ? 'scale-125 bounce' : ''}`}>
                    {isDragging ? '📂' : '📤'}
                    </div>
                    <p className="font-medium text-gray-700">
                    {isDragging ? 'Drop files here' : 'Click or Drag files to upload'}
                    </p>
                    <p className="text-sm text-gray-500">
                    {isEncrypted ? 'Files encrypted in browser - server never sees plaintext' : 'Supports multiple files (Max 100MB each)'}
                    </p>
                </div>
                </div>

                {/* Security Info */}
                <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 transition-all duration-300">
                <div className="flex items-start gap-3">
                    <span className="text-xl mt-0.5">🔐</span>
                    <div>
                    <p className="text-blue-900 text-sm font-bold">End-to-End Encrypted</p>
                    <p className="text-blue-700/80 text-xs leading-relaxed mt-0.5">
                        Files are encrypted on your device using AES-256-GCM before they are uploaded.
                        The server never sees your master password or the plaintext of your files.
                    </p>
                    </div>
                </div>
                </div>
            </>
        )}

        {/* Queue List */}
        {queue.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden divide-y divide-gray-100">
            {queue.map((item) => (
              <div key={item.id} className="p-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-sm">
                  {item.status === 'success' ? '✅' : item.status === 'error' ? '❌' : item.status === 'encrypting' ? '🔐' : '📄'}
                </div>

                <div className="flex-1 min-w-0">
                   <div className="flex justify-between items-center mb-1">
                     <p className="text-sm font-medium text-gray-700 truncate">{item.file.name}</p>
                     <div className="flex items-center gap-2">
                       <span className={`text-xs font-semibold ${
                         item.status === 'success' ? 'text-green-600' :
                         item.status === 'error' ? 'text-red-600' :
                         item.status === 'encrypting' ? 'text-amber-600' :
                         'text-blue-600'
                       }`}>
                         {item.status === 'success' ? 'Completed' :
                          item.status === 'error' ? 'Failed' :
                          item.status === 'encrypting' ? 'Encrypting...' :
                          item.status === 'uploading' ? 'Uploading...' : 'Waiting for password...'}
                       </span>
                       {(item.status === 'uploading' || item.status === 'encrypting' || item.status === 'pending') && (
                         <button
                           onClick={() => cancelUpload(item.id)}
                           className="px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 rounded transition-colors"
                         >
                           Cancel
                         </button>
                       )}
                     </div>
                   </div>

                  {/* Progress Bar */}
                  <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 rounded-full ${
                        item.status === 'success' ? 'bg-green-500' :
                        item.status === 'error' ? 'bg-red-500' :
                        item.status === 'encrypting' ? 'bg-amber-500' :
                        'bg-blue-500'
                      }`}
                      style={{ width: `${item.status === 'success' || item.status === 'error' || item.status === 'encrypting' ? 100 : item.progress}%` }}
                    />
                  </div>

                  {/* Progress Stage and ETA */}
                  {item.error ? (
                    <p className="text-xs text-red-500 mt-1">{item.error}</p>
                  ) : (
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-600">
                      {item.progressStage && (
                        <span>
                          {item.progressStage.replace(/chunk \d+\/\d+/i, '').trim()}
                        </span>
                      )}
                      <span className="font-medium text-gray-700">
                        {Math.round(item.progress)}%
                      </span>
                      {item.estimatedTimeRemaining !== null && item.status === 'uploading' && item.progress > 0 && item.progress < 100 && (
                        <span className="font-medium text-blue-600">
                          • ETA: {formatTimeRemaining(item.estimatedTimeRemaining)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <PasswordPromptModal
        isOpen={showPasswordPrompt}
        onSubmit={handlePasswordSubmit}
        onCancel={() => {
          setShowPasswordPrompt(false);
          setPendingFileForUpload(null);
          setCustomFileName('');
          setQueue(prev => prev.filter(f => f.id !== pendingFileForUpload?.id));
        }}
        isLoading={isVerifyingPassword}
        fileName={pendingFileForUpload?.file?.name || ''}
        onFileNameChange={(newName) => {
          // Extract extension from original filename
          const originalExt = pendingFileForUpload?.file?.name?.substring(
            pendingFileForUpload.file.name.lastIndexOf('.')
          ) || '';

          // Remove extension from input if provided
          const nameWithoutExt = newName.includes('.')
            ? newName.substring(0, newName.lastIndexOf('.'))
            : newName;

          // Combine with original extension
          setCustomFileName(nameWithoutExt + originalExt);
        }}
      />
    </>
  );
});

UploadForm.displayName = 'UploadForm';

export default UploadForm;
