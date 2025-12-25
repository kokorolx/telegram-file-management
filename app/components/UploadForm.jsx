'use client';
import { useState, useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from 'react';

import { useEncryption } from '../contexts/EncryptionContext';
import PasswordPromptModal from './PasswordPromptModal';
import LargeVideoWarningModal from './LargeVideoWarningModal';
import { encryptFileChunks } from '@/lib/browserUploadEncryption';
import { fragmentMP4, getFragmentationInfo, isFragmentationSupported } from '@/lib/videoFragmentation';
import { isMp4FragmentationEnabled } from '@/lib/featureFlags';
import { config } from '@/lib/config';

const UploadForm = forwardRef(({ onFileUploaded, currentFolderId, externalFiles, hideDropZone = false }, ref) => {
  const { masterPassword, isUnlocked, unlock } = useEncryption();
  const [queue, setQueue] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const isEncrypted = true; // Always use browser-side encryption
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);
  const [pendingFileForUpload, setPendingFileForUpload] = useState(null);
  const [customFileName, setCustomFileName] = useState('');
  const [showLargeVideoWarning, setShowLargeVideoWarning] = useState(false);
  const [largeVideoWarningFile, setLargeVideoWarningFile] = useState(null);
  const fileInputRef = useRef(null);
  const abortControllersRef = useRef(new Map()); // Track abort controllers per file
  const MAX_CONCURRENT_FILES = config.maxConcurrentChunkFetches;

  // MP4 fragmentation control - Direct from feature flag
  const isFragmentationActive = isMp4FragmentationEnabled();
  const [fragmentationProgress, setFragmentationProgress] = useState(0);
  const [isFragmenting, setIsFragmenting] = useState(false);
  const fragmentationInfo = getFragmentationInfo();

  // Expose file input to parent
  useImperativeHandle(ref, () => ({
    openFilePicker: () => {
      fileInputRef.current?.click();
    }
  }));

  // Handle external files (e.g. from global DropZone or FolderCard)
  useEffect(() => {
    if (!externalFiles) return;

    // Handle both FileList/Array (global drop) AND { files, targetFolderId } (folder drop)
    if (externalFiles.targetFolderId && externalFiles.files) {
      addFilesToQueue(externalFiles.files, externalFiles.targetFolderId);
    } else if (externalFiles.length > 0) {
      addFilesToQueue(externalFiles);
    }
  }, [externalFiles]);

  const addFilesToQueue = (fileList, folderId = null) => {
    const MAX_FRAGMENTATION_SIZE = 200 * 1024 * 1024; // 200MB
    
    const newFiles = Array.from(fileList).map(file => {
      // Check if video is too large for streaming (only warn if streaming is enabled)
      const isMP4Video = (file.type === 'video/mp4' || file.type === 'video/quicktime' || file.name.toLowerCase().endsWith('.mp4') || file.name.toLowerCase().endsWith('.mov'));
      const isFileTooLarge = isMP4Video && file.size > MAX_FRAGMENTATION_SIZE;
      
      if (isFileTooLarge && isFragmentationActive) {
        // Show warning modal only if streaming feature is enabled
        setLargeVideoWarningFile({
          file,
          folderId: folderId || currentFolderId,
          sizeMB: (file.size / (1024 * 1024)).toFixed(1)
        });
        setShowLargeVideoWarning(true);
        return null; // Don't add to queue yet
      }
      
      return {
        file,
        id: Math.random().toString(36).substr(2, 9),
        status: 'pending', // pending, uploading, success, error
        progress: 0,
        error: null,
        folderId: folderId || currentFolderId, // Use target folder if provided, else current
        progressStage: '', // 'Encrypting chunk X/Y', 'Uploading chunk X/Y', etc
        startTime: null, // Track when upload starts
        estimatedTimeRemaining: null, // ETA in seconds
        isFragmenting: false, // Track if currently fragmenting
      };
    }).filter(f => f !== null);

    newFiles.forEach(f => {
      console.log(`[UploadForm] Added file: ${f.file.name}, Type: ${f.file.type}, Size: ${f.file.size}`);
    });

    setQueue(prev => [...prev, ...newFiles]);
  };

  // Diagnostic log on every render to track feature status
  useEffect(() => {
    if (queue.length > 0) {
      console.log('[UploadForm] Feature Status:', {
        isEnabled: isMp4FragmentationEnabled(),
        isSupported: isFragmentationSupported(),
        hasVideo: queue.some(item => {
          const ext = item.file.name.toLowerCase().split('.').pop();
          const type = item.file.type.toLowerCase();
          return type === 'video/mp4' || type === 'video/quicktime' || ext === 'mp4' || ext === 'mov';
        }),
        queueLength: queue.length
      });
    }
  }, [queue.length]);

  // Handle password verification for upload
  const handlePasswordSubmit = async (password) => {
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

      // Password verified, proceed with upload
      setShowPasswordPrompt(false);
      setIsVerifyingPassword(false);

      // Continue with the file that was waiting
      if (pendingFileForUpload) {
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

    // Abort any ongoing fetch requests
    const abortController = abortControllersRef.current.get(fileId);
    if (abortController) {
      abortController.abort();
      abortControllersRef.current.delete(fileId);
    }

    // Remove from queue
    setQueue(prev => prev.filter(f => f.id !== fileId));
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
  const calculateETA = (fileSize, progress, uploadStartTime, stage, bytesAlreadyUploaded = 0) => {
    if (!uploadStartTime) return null;
    if (progress <= 0 || progress >= 100) return null;

    // Only calculate ETA once we're in uploading phase (not encrypting)
    const isUploadingPhase = stage && stage.toLowerCase().includes('uploading');
    if (!isUploadingPhase) return null;

    const elapsedMs = Date.now() - uploadStartTime;
    const elapsedSeconds = elapsedMs / 1000;

    // Don't estimate if upload just started (less than 0.5 seconds)
    if (elapsedSeconds < 0.5) {
      return null;
    }

    // Calculate bytes uploaded in current upload phase (not including already-uploaded before resume)
    const bytesUploadedNow = (fileSize * progress) / 100 - bytesAlreadyUploaded;
    const bytesPerSecond = bytesUploadedNow / elapsedSeconds;

    if (bytesPerSecond <= 0) return null;

    // Remaining bytes = total size - (already uploaded + now uploaded)
    const remainingBytes = fileSize - ((fileSize * progress) / 100);
    const estimatedSeconds = remainingBytes / bytesPerSecond;

    return estimatedSeconds > 0 ? estimatedSeconds : null;
  };

  const uploadFile = useCallback(async (fileItem, password) => {
     // const startTime = Date.now();

     // Create abort controller for this upload
     const abortController = new AbortController();
     abortControllersRef.current.set(fileItem.id, abortController);

     let processedFile = fileItem.file;
     let wasFragmented = false;

     // MP4 Fragmentation (if enabled for MP4/MOV videos)
     const isMP4Video = (fileItem.file.type === 'video/mp4' || fileItem.file.type === 'video/quicktime' || fileItem.file.name.toLowerCase().endsWith('.mp4') || fileItem.file.name.toLowerCase().endsWith('.mov'));
     
     // CRITICAL: Check browser support (SharedArrayBuffer) before attempting
     const shouldFragment = isFragmentationActive && isMP4Video && isFragmentationSupported() && fileItem.file.size <= (200 * 1024 * 1024);

     console.log(`[Upload] Fragmentation decision for ${fileItem.file.name}:`, {
       shouldFragment,
       isFragmentationActive,
       isMP4Video,
       fileSize: fileItem.file.size,
       isSupported: isFragmentationSupported()
     });

     let videoDuration = null;
     
     if (shouldFragment) {
       try {
         setQueue(prev => prev.map(f =>
           f.id === fileItem.id ? { ...f, isFragmenting: true } : f
         ));
         setIsFragmenting(true);
         setFragmentationProgress(0);

         const result = await fragmentMP4(fileItem.file, (progress) => {
           setFragmentationProgress(progress);
           updateFileStatus(fileItem.id, 'pending', progress, null, `Fragmenting video: ${progress.toFixed(0)}%`);
         });

         const { blob: fragmentedBlob, duration } = result;
         videoDuration = duration;

         console.log(`[FFMPEG] Browser fragmentation successful for ${fileItem.file.name}`);
         console.log(`[FFMPEG] Size comparison - Original: ${fileItem.file.size}, Fragmented: ${fragmentedBlob.size}`);
         if (videoDuration) {
           console.log(`[FFMPEG] Video duration: ${videoDuration}s`);
         }

         processedFile = new File([fragmentedBlob], fileItem.file.name, { type: 'video/mp4' });
         wasFragmented = true;
         setIsFragmenting(false);
         setQueue(prev => prev.map(f =>
           f.id === fileItem.id ? { ...f, isFragmenting: false } : f
         ));
       } catch (fragErr) {
         console.warn('[UPLOAD] Fragmentation failed, uploading original:', fragErr);
         // Continue with original file on fragmentation failure
         setIsFragmenting(false);
         setQueue(prev => prev.map(f =>
           f.id === fileItem.id ? { ...f, isFragmenting: false } : f
         ));
       }
     }

     console.log(`[Upload] Starting encryption/upload for ${fileItem.file.name}. Fragmented: ${wasFragmented}`);

     // Update status to uploading and record start time
     const uploadStartTime = Date.now();
     setQueue(prev => prev.map(f =>
       f.id === fileItem.id ? { ...f, startTime: uploadStartTime } : f
     ));
     updateFileStatus(fileItem.id, 'uploading', 0);

    try {
      // NEW: Check for resumable upload
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
        console.log(`[Upload] Resuming upload for ${fileItem.file.name} (File ID: ${fileId}) from chunk ${resumeFrom}`);

        // Retrieve the saved chunk plan from server
        const chunkPlanRes = await fetch(
          `/api/upload/chunk-plan?file_id=${fileId}`,
          { signal: abortController.signal }
        );
        if (chunkPlanRes.ok) {
          const chunkPlanData = await chunkPlanRes.json();
          chunkPlan = chunkPlanData.chunk_sizes;
          console.log(`[Upload] Retrieved chunk plan for resumed upload:`, chunkPlan);
        }

        updateFileStatus(
          fileItem.id,
          'uploading',
          (resumeFrom / checkData.total_chunks) * 100,
          null,
          `Resuming from chunk ${resumeFrom}/${checkData.total_chunks}`
        );
      } else if (checkData.exists) {
        console.warn(`[Upload] File ${fileItem.file.name} already uploaded, but cannot resume.`);
        updateFileStatus(fileItem.id, 'error', 0, 'File already uploaded');
        return;
      } else {
        console.log(`[Upload] Starting new upload for ${fileItem.file.name}`);
      }

      // If encrypted upload, use browser-side encryption
        try {
          // Track upload start time locally (not in state) so we can use it immediately
          let uploadStartTimeLocal = null;

          await encryptFileChunks(
             processedFile,
             password,
             (partNumber, totalParts, stage) => {
               // Calculate progress as percentage
               // partNumber already includes skipped chunks from resume, so use it directly
               const progress = (partNumber / totalParts) * 100;

               // Detect when uploading phase starts and set uploadStartTime locally
               const isNowUploading = stage && stage.toLowerCase().includes('uploading');

               if (isNowUploading && !uploadStartTimeLocal) {
                 uploadStartTimeLocal = Date.now();
               }

               // Calculate ETA based on upload speed
               // For resumed uploads, use actual chunk sizes (not uniform) to calculate bytes already uploaded
               let bytesAlreadyUploaded = 0;
               if (isResume && chunkPlan && chunkPlan.length > 0) {
                 // Sum the sizes of chunks that were already uploaded (before resumeFrom)
                 bytesAlreadyUploaded = chunkPlan.slice(0, Math.max(0, resumeFrom - 1)).reduce((sum, size) => sum + size, 0);
               }
               const eta = calculateETA(fileItem.file.size, progress, uploadStartTimeLocal, stage, bytesAlreadyUploaded);

               updateFileStatus(fileItem.id, 'uploading', progress, null, stage, eta);
             },
             fileItem.folderId, // Use the folderId stored in the file item
             abortController.signal,
             fileId,        // Pass file_id for resume
             resumeFrom,    // Pass resume starting point
             chunkPlan,     // Pass saved chunk sizes for resume
             wasFragmented, // Pass fragmentation flag
             videoDuration  // Pass extracted video duration in seconds
           );

          updateFileStatus(fileItem.id, 'success', 100);
          console.log(`[Upload] Successfully uploaded ${fileItem.file.name} (ID: ${fileItem.id})`);
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
        console.log(`[Upload] Upload for ${fileItem.file.name} (ID: ${fileItem.id}) was cancelled.`);
        // Already removed from queue by cancelUpload
      } else {
        console.error(`[UPLOAD] ${fileItem.id} - FAILED:`, err.message);
        updateFileStatus(fileItem.id, 'error', 0, err.message);
      }
    }
  }, [currentFolderId, onFileUploaded, updateFileStatus, isFragmentationActive]);

  // Process queue
  useEffect(() => {
    const processQueue = async () => {
      const uploadingCount = queue.filter(f => f.status === 'uploading').length;
      if (uploadingCount >= MAX_CONCURRENT_FILES) return;

      const pendingFiles = queue.filter(f => f.status === 'pending' && !f.isFragmenting);
      if (pendingFiles.length === 0) return;

      // Process up to the concurrency limit
      const itemsToStart = pendingFiles.slice(0, MAX_CONCURRENT_FILES - uploadingCount);

      for (const pendingFile of itemsToStart) {
        // All files must be encrypted
        if (isUnlocked && masterPassword) {
          // User already unlocked - use the master password automatically
          uploadFile(pendingFile, masterPassword);
        } else if (!showPasswordPrompt) {
          // User not unlocked - show password prompt to unlock
          setPendingFileForUpload(pendingFile);
          setShowPasswordPrompt(true);
          // Only show prompt for the first one, others will wait
          break;
        }
      }
    };

    // Only run if there are pending files that aren't currently fragmenting
    if (queue.some(f => f.status === 'pending' && !f.isFragmenting)) {
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

        {/* Fragmentation Status Indicator (Only show while processing) */}
        {isFragmenting && (
          <div className="bg-purple-50/50 border border-purple-100 rounded-xl p-4 transition-all duration-300 animate-pulse">
            <div className="flex items-center gap-3">
              <span className="text-xl">🎬</span>
              <div className="flex-1">
                <p className="text-purple-900 text-sm font-bold">Optimizing Video for Streaming...</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-1.5 bg-purple-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-500 transition-all duration-300"
                      style={{ width: `${fragmentationProgress}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-bold text-purple-600">{Math.round(fragmentationProgress)}%</span>
                </div>
              </div>
            </div>
          </div>
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
                      {item.status === 'uploading' && item.progress > 0 && item.progress < 100 && (
                        <span className={`font-medium ${item.estimatedTimeRemaining !== null ? 'text-blue-600' : 'text-amber-500'}`}>
                          • ETA: {item.estimatedTimeRemaining !== null ? formatTimeRemaining(item.estimatedTimeRemaining) : 'calculating...'}
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

      <LargeVideoWarningModal
        isOpen={showLargeVideoWarning}
        fileName={largeVideoWarningFile?.file?.name || ''}
        fileSizeMB={largeVideoWarningFile?.sizeMB || ''}
        onContinue={() => {
          // Add the file to queue after user confirms
          if (largeVideoWarningFile) {
            const fileItem = {
              file: largeVideoWarningFile.file,
              id: Math.random().toString(36).substr(2, 9),
              status: 'pending',
              progress: 0,
              error: null,
              folderId: largeVideoWarningFile.folderId,
              progressStage: '',
              startTime: null,
              estimatedTimeRemaining: null,
              isFragmenting: false,
            };
            setQueue(prev => [...prev, fileItem]);
          }
          setShowLargeVideoWarning(false);
          setLargeVideoWarningFile(null);
        }}
        onCancel={() => {
          setShowLargeVideoWarning(false);
          setLargeVideoWarningFile(null);
        }}
      />
    </>
  );
});

UploadForm.displayName = 'UploadForm';

export default UploadForm;
