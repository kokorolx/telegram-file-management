/**
 * Feature Flags for Recovery Codes
 * 
 * Provides centralized feature flag management for gradual rollout
 * and easy kill switch during production deployment.
 * 
 * Usage:
 * - In components: import { isRecoveryCodesEnabled } from '@/lib/featureFlags'
 * - In API routes: import { isRecoveryCodesEnabled } from '@/lib/featureFlags'
 */

/**
 * Check if recovery codes feature is enabled
 * 
 * Environment variable: FEATURE_RECOVERY_CODES_ENABLED
 * Default: 'false' (feature disabled for gradual rollout)
 * 
 * @returns {boolean} true if recovery codes are enabled
 */
export const isRecoveryCodesEnabled = () => {
  // Default to false for safe rollout (can be enabled via env var)
  const enabled = process.env.FEATURE_RECOVERY_CODES_ENABLED === 'true';
  return enabled;
};

/**
 * Check if recovery codes are enabled for beta testing
 * Useful for enabling feature only for new users
 * 
 * @returns {boolean} true if beta mode is enabled
 */
export const isRecoveryCodesBeta = () => {
  return process.env.FEATURE_RECOVERY_CODES_BETA === 'true';
};

/**
 * Get rollout percentage for gradual deployment
 * Example: 10 means 10% of users see the feature
 * 
 * @returns {number} percentage (0-100)
 */
export const getRecoveryCodesRolloutPercent = () => {
  const percent = parseInt(process.env.FEATURE_RECOVERY_CODES_ROLLOUT_PERCENT || '0', 10);
  return Math.max(0, Math.min(100, percent)); // Clamp between 0-100
};

/**
 * Check if recovery codes should be visible for a specific user
 * Uses hash-based consistent assignment for same rollout across deployments
 * 
 * @param {string} userId - User ID to check
 * @returns {boolean} true if user should see feature
 */
export const isRecoveryCodesEnabledForUser = (userId) => {
  // If fully enabled, show to everyone
  if (isRecoveryCodesEnabled()) {
    return true;
  }

  // If beta mode, use rollout percentage
  if (isRecoveryCodesBeta()) {
    const percent = getRecoveryCodesRolloutPercent();
    if (percent === 0) return false;
    if (percent >= 100) return true;

    // Hash-based assignment for consistent rollout
    // Same user always gets same assignment across deployments
    const hash = hashUserId(userId);
    return (hash % 100) < percent;
  }

  return false;
};

/**
 * Simple hash function for user ID to rollout percentage mapping
 * Creates deterministic bucket assignment
 * 
 * @param {string} userId - User ID
 * @returns {number} hash value
 */
function hashUserId(userId) {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Get feature flag status for logging/debugging
 * 
 * @returns {object} Current feature flag state
 */
export const getRecoveryCodesFeatureStatus = () => {
  return {
    enabled: isRecoveryCodesEnabled(),
    beta: isRecoveryCodesBeta(),
    rolloutPercent: getRecoveryCodesRolloutPercent(),
    environment: process.env.NODE_ENV || 'unknown'
  };
};
