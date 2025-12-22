export const blobCache = new Map();

// Track pending decryption requests to prevent concurrent fetches
const pendingDecryptions = new Map();

/**
 * Get or create a promise for decrypting a file blob.
 * Multiple concurrent requests for the same fileId will wait for the same promise.
 * @param {string} fileId - File ID
 * @param {Function} decryptFn - Async function that performs the decryption
 * @returns {Promise<Object>} Cache entry { url, timestamp }
 */
export async function getCachedOrDecrypt(fileId, decryptFn) {
  // Check if already cached
  const cached = blobCache.get(fileId);
  if (cached) {
    return cached;
  }

  // Check if already pending
  if (pendingDecryptions.has(fileId)) {
    return await pendingDecryptions.get(fileId);
  }

  // Create new decryption promise
  const promise = decryptFn().then(url => {
    const entry = { url, timestamp: Date.now() };
    blobCache.set(fileId, entry);
    pendingDecryptions.delete(fileId);
    return entry;
  }).catch(err => {
    pendingDecryptions.delete(fileId);
    throw err;
  });

  pendingDecryptions.set(fileId, promise);
  return await promise;
}

/**
 * Revokes all object URLs and clears the cache.
 * Should be called when the vault is locked to free memory and ensure security.
 */
export const clearSecureCache = () => {
  if (typeof window === 'undefined') return;

  blobCache.forEach((value) => {
    try {
      URL.revokeObjectURL(value.url);
    } catch (e) {
      console.warn('Failed to revoke url', e);
    }
  });
  blobCache.clear();
  console.log('Secure image cache cleared.');
};
