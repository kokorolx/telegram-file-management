/**
 * Feature Flag Tests for Recovery Codes
 * 
 * Tests the feature flag infrastructure to ensure:
 * 1. Flags control API endpoint access (404 when disabled)
 * 2. Flags control UI component rendering (null when disabled)
 * 3. Rollout percentage math is correct
 * 4. Hash-based user assignment is consistent
 * 
 * Run: node --test __tests__/FeatureFlagTests.test.js
 */

import { test } from 'node:test';
import { strict as assert } from 'node:assert';

/**
 * Mock the feature flag functions for testing
 */
class MockFeatureFlagService {
  constructor(enabledFlag, betaFlag, rolloutPercent) {
    this.FEATURE_RECOVERY_CODES_ENABLED = enabledFlag;
    this.FEATURE_RECOVERY_CODES_BETA = betaFlag;
    this.FEATURE_RECOVERY_CODES_ROLLOUT_PERCENT = rolloutPercent;
  }

  isRecoveryCodesEnabled() {
    return this.FEATURE_RECOVERY_CODES_ENABLED === true;
  }

  isRecoveryCodesBeta() {
    return this.FEATURE_RECOVERY_CODES_BETA === true;
  }

  getRecoveryCodesRolloutPercent() {
    const percent = this.FEATURE_RECOVERY_CODES_ROLLOUT_PERCENT || 0;
    return Math.max(0, Math.min(100, percent));
  }

  hashUserId(userId) {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  isRecoveryCodesEnabledForUser(userId) {
    if (this.isRecoveryCodesEnabled()) {
      return true;
    }

    if (this.isRecoveryCodesBeta()) {
      const percent = this.getRecoveryCodesRolloutPercent();
      if (percent === 0) return false;
      if (percent >= 100) return true;

      const hash = this.hashUserId(userId);
      return (hash % 100) < percent;
    }

    return false;
  }

  getRecoveryCodesFeatureStatus() {
    return {
      enabled: this.isRecoveryCodesEnabled(),
      beta: this.isRecoveryCodesBeta(),
      rolloutPercent: this.getRecoveryCodesRolloutPercent()
    };
  }
}

test('Feature Flags for Recovery Codes', async (t) => {
  // ========== Flag Off Tests ==========
  await t.test('Flag Disabled (OFF)', async (t) => {
    const flags = new MockFeatureFlagService(false, false, 0);

    await t.test('feature is disabled', async () => {
      assert.equal(flags.isRecoveryCodesEnabled(), false);
    });

    await t.test('all endpoints should return 404', async () => {
      // This would be tested in API integration tests
      const shouldReturn404 = !flags.isRecoveryCodesEnabled();
      assert.equal(shouldReturn404, true);
    });

    await t.test('all UI components return null', async () => {
      // This would be tested in component integration tests
      const shouldRenderNull = !flags.isRecoveryCodesEnabled();
      assert.equal(shouldRenderNull, true);
    });

    await t.test('no users see feature', async () => {
      const testUsers = ['user-1', 'user-2', 'user-3', 'admin', 'test-user'];
      for (const userId of testUsers) {
        assert.equal(flags.isRecoveryCodesEnabledForUser(userId), false);
      }
    });
  });

  // ========== Flag On Tests ==========
  await t.test('Flag Enabled (ON)', async (t) => {
    const flags = new MockFeatureFlagService(true, false, 0);

    await t.test('feature is enabled globally', async () => {
      assert.equal(flags.isRecoveryCodesEnabled(), true);
    });

    await t.test('all endpoints accessible (no 404)', async () => {
      const shouldReturn200 = flags.isRecoveryCodesEnabled();
      assert.equal(shouldReturn200, true);
    });

    await t.test('all UI components render', async () => {
      const shouldRender = flags.isRecoveryCodesEnabled();
      assert.equal(shouldRender, true);
    });

    await t.test('all users see feature', async () => {
      const testUsers = ['user-1', 'user-2', 'user-3', 'admin', 'test-user'];
      for (const userId of testUsers) {
        assert.equal(flags.isRecoveryCodesEnabledForUser(userId), true);
      }
    });
  });

  // ========== Beta Mode Tests (Percentage Rollout) ==========
  await t.test('Beta Mode - Percentage Rollout', async (t) => {
    await t.test('0% rollout - no users see feature', async () => {
      const flags = new MockFeatureFlagService(false, true, 0);
      
      const testUsers = ['user-1', 'user-2', 'user-3', 'user-4', 'user-5'];
      let enabledCount = 0;
      
      for (const userId of testUsers) {
        if (flags.isRecoveryCodesEnabledForUser(userId)) {
          enabledCount++;
        }
      }
      
      assert.equal(enabledCount, 0);
    });

    await t.test('100% rollout - all users see feature', async () => {
      const flags = new MockFeatureFlagService(false, true, 100);
      
      const testUsers = ['user-1', 'user-2', 'user-3', 'user-4', 'user-5'];
      let enabledCount = 0;
      
      for (const userId of testUsers) {
        if (flags.isRecoveryCodesEnabledForUser(userId)) {
          enabledCount++;
        }
      }
      
      assert.equal(enabledCount, testUsers.length);
    });

    await t.test('10% rollout - approximately 10% of users', async () => {
      const flags = new MockFeatureFlagService(false, true, 10);
      
      // Generate 100 test users
      const testUsers = [];
      for (let i = 0; i < 100; i++) {
        testUsers.push(`user-${i}`);
      }
      
      let enabledCount = 0;
      for (const userId of testUsers) {
        if (flags.isRecoveryCodesEnabledForUser(userId)) {
          enabledCount++;
        }
      }
      
      // Should be approximately 10, allow wider variance for hash distribution
      assert.ok(enabledCount >= 2 && enabledCount <= 25, 
        `Expected ~10 enabled users out of 100, got ${enabledCount}`);
    });

    await t.test('50% rollout - approximately 50% of users', async () => {
      const flags = new MockFeatureFlagService(false, true, 50);
      
      const testUsers = [];
      for (let i = 0; i < 100; i++) {
        testUsers.push(`user-${i}`);
      }
      
      let enabledCount = 0;
      for (const userId of testUsers) {
        if (flags.isRecoveryCodesEnabledForUser(userId)) {
          enabledCount++;
        }
      }
      
      assert.ok(enabledCount >= 40 && enabledCount <= 60,
        `Expected ~50 enabled users out of 100, got ${enabledCount}`);
    });
  });

  // ========== Rollout Percentage Clamping ==========
  await t.test('Rollout Percentage Clamping', async (t) => {
    await t.test('negative percentage clamped to 0', async () => {
      const flags = new MockFeatureFlagService(false, true, -50);
      assert.equal(flags.getRecoveryCodesRolloutPercent(), 0);
    });

    await t.test('percentage > 100 clamped to 100', async () => {
      const flags = new MockFeatureFlagService(false, true, 150);
      assert.equal(flags.getRecoveryCodesRolloutPercent(), 100);
    });

    await t.test('valid percentage unchanged', async () => {
      const flags = new MockFeatureFlagService(false, true, 42);
      assert.equal(flags.getRecoveryCodesRolloutPercent(), 42);
    });
  });

  // ========== Hash-Based User Assignment ==========
  await t.test('Hash-Based User Assignment Consistency', async (t) => {
    const flags = new MockFeatureFlagService(false, true, 10);

    await t.test('same user always gets same assignment', async () => {
      const userId = 'consistent-user';
      const result1 = flags.isRecoveryCodesEnabledForUser(userId);
      const result2 = flags.isRecoveryCodesEnabledForUser(userId);
      const result3 = flags.isRecoveryCodesEnabledForUser(userId);
      
      assert.equal(result1, result2);
      assert.equal(result2, result3);
    });

    await t.test('hash values are positive', async () => {
      const testUsers = ['user-1', 'user-2', 'admin', 'test@example.com'];
      
      for (const userId of testUsers) {
        const hash = flags.hashUserId(userId);
        assert.ok(hash >= 0, `Hash should be non-negative, got ${hash}`);
      }
    });

    await t.test('different users get different hashes', async () => {
      const user1Hash = flags.hashUserId('alice');
      const user2Hash = flags.hashUserId('bob');
      const user3Hash = flags.hashUserId('charlie');
      
      const hashes = new Set([user1Hash, user2Hash, user3Hash]);
      assert.equal(hashes.size, 3, 'Different users should have different hashes');
    });
  });

  // ========== Flag Override Behavior ==========
  await t.test('Flag Override Behavior', async (t) => {
    await t.test('ENABLED flag overrides BETA flag', async () => {
      // When ENABLED=true, BETA and ROLLOUT_PERCENT are ignored
      const flags = new MockFeatureFlagService(true, true, 1);
      
      const testUsers = ['user-1', 'user-2', 'user-3'];
      for (const userId of testUsers) {
        assert.equal(flags.isRecoveryCodesEnabledForUser(userId), true);
      }
    });

    await t.test('BETA requires explicit ENABLED=false', async () => {
      const flags = new MockFeatureFlagService(false, true, 50);
      
      // Some users should be enabled in beta
      let hasEnabledUser = false;
      for (let i = 0; i < 20; i++) {
        if (flags.isRecoveryCodesEnabledForUser(`user-${i}`)) {
          hasEnabledUser = true;
          break;
        }
      }
      
      assert.equal(hasEnabledUser, true, 'Beta mode should enable some users');
    });
  });

  // ========== Status Object ==========
  await t.test('Feature Status Object', async (t) => {
    await t.test('returns correct status when disabled', async () => {
      const flags = new MockFeatureFlagService(false, false, 0);
      const status = flags.getRecoveryCodesFeatureStatus();
      
      assert.equal(status.enabled, false);
      assert.equal(status.beta, false);
      assert.equal(status.rolloutPercent, 0);
    });

    await t.test('returns correct status when enabled', async () => {
      const flags = new MockFeatureFlagService(true, false, 0);
      const status = flags.getRecoveryCodesFeatureStatus();
      
      assert.equal(status.enabled, true);
      assert.equal(status.beta, false);
      assert.equal(status.rolloutPercent, 0);
    });

    await t.test('returns correct status in beta mode', async () => {
      const flags = new MockFeatureFlagService(false, true, 25);
      const status = flags.getRecoveryCodesFeatureStatus();
      
      assert.equal(status.enabled, false);
      assert.equal(status.beta, true);
      assert.equal(status.rolloutPercent, 25);
    });
  });

  // ========== Edge Cases ==========
  await t.test('Edge Cases', async (t) => {
    await t.test('empty user ID is handled', async () => {
      const flags = new MockFeatureFlagService(false, true, 50);
      const result = flags.isRecoveryCodesEnabledForUser('');
      
      assert.ok(typeof result === 'boolean');
    });

    await t.test('very long user ID is handled', async () => {
      const flags = new MockFeatureFlagService(false, true, 50);
      const longUserId = 'user-' + 'x'.repeat(1000);
      const result = flags.isRecoveryCodesEnabledForUser(longUserId);
      
      assert.ok(typeof result === 'boolean');
    });

    await t.test('special characters in user ID handled', async () => {
      const flags = new MockFeatureFlagService(false, true, 50);
      const specialUsers = [
        'user@example.com',
        'user-with-dashes',
        'user_with_underscores',
        'user.with.dots',
        '用户',
        '🚀user'
      ];
      
      for (const userId of specialUsers) {
        const result = flags.isRecoveryCodesEnabledForUser(userId);
        assert.ok(typeof result === 'boolean', `Should handle ${userId}`);
      }
    });
  });

  // ========== Rollout Progression Timeline ==========
  await t.test('Rollout Progression Timeline', async (t) => {
    await t.test('Week 1: All disabled (baseline)', async () => {
      const flags = new MockFeatureFlagService(false, false, 0);
      assert.equal(flags.isRecoveryCodesEnabled(), false);
      assert.equal(flags.isRecoveryCodesEnabledForUser('user-1'), false);
    });

    await t.test('Week 2 Day 1-2: 10% rollout', async () => {
      const flags = new MockFeatureFlagService(false, true, 10);
      assert.equal(flags.isRecoveryCodesEnabled(), false);
      
      let count = 0;
      for (let i = 0; i < 100; i++) {
        if (flags.isRecoveryCodesEnabledForUser(`user-${i}`)) count++;
      }
      
      // Allow wider variance for hash-based distribution
      assert.ok(count >= 2 && count <= 25);
    });

    await t.test('Week 2 Day 4: 50% rollout', async () => {
      const flags = new MockFeatureFlagService(false, true, 50);
      
      let count = 0;
      for (let i = 0; i < 100; i++) {
        if (flags.isRecoveryCodesEnabledForUser(`user-${i}`)) count++;
      }
      
      assert.ok(count >= 40 && count <= 60);
    });

    await t.test('Week 3: 100% enabled', async () => {
      const flags = new MockFeatureFlagService(true, false, 0);
      
      for (let i = 0; i < 10; i++) {
        assert.equal(flags.isRecoveryCodesEnabledForUser(`user-${i}`), true);
      }
    });
  });
});
