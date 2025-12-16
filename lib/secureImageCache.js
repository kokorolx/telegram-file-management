export const blobCache = new Map();

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
