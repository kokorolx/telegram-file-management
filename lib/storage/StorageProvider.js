/**
 * Base class for all storage providers.
 */
export class StorageProvider {
  /**
   * Upload a chunk of data.
   * @param {string} userId
   * @param {Buffer} buffer
   * @param {string} filename
   * @returns {Promise<string>} Unique file identifier (e.g. telegram_file_id or S3 key)
   */
  async uploadChunk(userId, buffer, filename) {
    throw new Error('uploadChunk must be implemented');
  }

  /**
   * Get a download URL for a chunk.
   * @param {string} userId
   * @param {string} storageId
   * @returns {Promise<string>}
   */
  async getDownloadUrl(userId, storageId) {
    throw new Error('getDownloadUrl must be implemented');
  }

  /**
   * Delete a chunk if supported.
   * @param {string} storageId
   * @returns {Promise<boolean>}
   */
  async deleteChunk(storageId) {
    throw new Error('deleteChunk must be implemented');
  }
}
