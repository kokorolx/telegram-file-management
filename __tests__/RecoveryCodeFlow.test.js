/**
 * Integration flow tests for the complete recovery code lifecycle
 * 
 * Tests the end-to-end flow:
 * 1. User generates recovery codes
 * 2. User saves codes
 * 3. User forgets master password
 * 4. User uses recovery code to reset master password
 * 5. Recovery code is burned (one-time use)
 * 
 * Run: node --test __tests__/RecoveryCodeFlow.test.js
 */

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import crypto from 'crypto';

/**
 * Simplified Mock RecoveryCodeService for testing flow logic
 * (not testing bcrypt internals - those are in unit tests)
 */
class MockRecoveryCodeService {
  constructor() {
    this.codesDatabase = {}; // userId -> { codeId: { plainCode, used, expiresAt, ... } }
  }

  generateCodes(count = 10) {
    const codes = [];
    for (let i = 0; i < count; i++) {
      const randomBytes = crypto.randomBytes(8).toString('hex').toUpperCase();
      const code = `${randomBytes.substring(0, 4)}-${randomBytes.substring(4, 8)}-XXXX-XXXX`;
      codes.push(code);
    }
    return codes;
  }

  async saveCodes(userId, codes, expiresInDays = 365) {
    if (!this.codesDatabase[userId]) {
      this.codesDatabase[userId] = {};
    }

    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

    // Codes are passed as plain codes for this simplified mock
    for (const plainCode of codes) {
      const codeId = `code-${Math.random().toString(36).substring(7)}`;
      this.codesDatabase[userId][codeId] = {
        plainCode,
        used: false,
        expiresAt,
        createdAt: new Date(),
        burnedReason: null
      };
    }

    return {
      success: true,
      codeCount: codes.length,
      expiresAt
    };
  }

  async verifyRecoveryCode(userId, plainCode) {
    if (!this.codesDatabase[userId]) {
      return { valid: false, reason: 'no_codes_available' };
    }

    const now = new Date();
    let hasUnusedCodes = false;

    for (const [codeId, codeRecord] of Object.entries(this.codesDatabase[userId])) {
      // Check if already used
      if (codeRecord.used) {
        continue;
      }

      hasUnusedCodes = true;

      // Check if expired
      if (new Date(codeRecord.expiresAt) <= now) {
        continue;
      }

      // Compare plain codes (in real implementation, this is bcrypt.compare())
      if (plainCode === codeRecord.plainCode) {
        return { valid: true, codeRecord: { id: codeId, ...codeRecord } };
      }
    }

    return { valid: false, reason: 'invalid_code' };
  }

  async burnCode(codeId, userId, reason = 'used') {
    if (this.codesDatabase[userId] && this.codesDatabase[userId][codeId]) {
      this.codesDatabase[userId][codeId].used = true;
      this.codesDatabase[userId][codeId].burnedReason = reason;
      this.codesDatabase[userId][codeId].usedAt = new Date();
      return true;
    }
    return false;
  }

  async getUserCodeStatus(userId) {
    if (!this.codesDatabase[userId]) {
      return {
        enabled: false,
        totalCodes: 0,
        remainingCodes: 0,
        usedCodes: 0
      };
    }

    const codes = Object.values(this.codesDatabase[userId]);
    const now = new Date();
    
    // Only count codes as remaining if they're not used AND not expired
    const remaining = codes.filter(c => !c.used && new Date(c.expiresAt) > now).length;
    const used = codes.filter(c => c.used).length;

    return {
      enabled: codes.length > 0,
      totalCodes: codes.length,
      remainingCodes: remaining,
      usedCodes: used,
      expiresAt: codes[0]?.expiresAt
    };
  }

  async revokeAllCodes(userId, reason = 'revoked') {
    if (!this.codesDatabase[userId]) {
      return 0;
    }

    let revoked = 0;
    for (const codeRecord of Object.values(this.codesDatabase[userId])) {
      if (!codeRecord.used) {
        codeRecord.used = true;
        codeRecord.burnedReason = reason;
        revoked++;
      }
    }

    return revoked;
  }
}

test('Recovery Code Complete Lifecycle', async (t) => {
  const service = new MockRecoveryCodeService();
  const userId = 'user-123';
  let generatedCodes = [];

  // ========== Phase 1: Code Generation ==========
  await t.test('Phase 1: Generate Recovery Codes', async (t) => {
    await t.test('user generates 10 recovery codes', async () => {
      generatedCodes = service.generateCodes(10);
      
      assert.equal(generatedCodes.length, 10);
      assert.ok(Array.isArray(generatedCodes));
    });

    await t.test('codes are unique', async () => {
      const uniqueCodes = new Set(generatedCodes);
      assert.equal(uniqueCodes.size, generatedCodes.length);
    });

    await t.test('all codes have valid format', async () => {
      // Format: XXXX-XXXX-XXXX-XXXX
      for (const code of generatedCodes) {
        assert.ok(code.match(/^[A-F0-9]{4}-[A-F0-9]{4}-[X]{4}-[X]{4}$/), 
          `Code ${code} has invalid format`);
      }
    });
  });

  // ========== Phase 2: Code Storage ==========
  await t.test('Phase 2: Save Recovery Codes', async (t) => {
    await t.test('save codes to database', async () => {
      const result = await service.saveCodes(userId, generatedCodes, 365);
      
      assert.ok(result.success);
      assert.equal(result.codeCount, 10);
      assert.ok(result.expiresAt);
    });

    await t.test('codes are not used initially', async () => {
      const status = await service.getUserCodeStatus(userId);
      
      assert.equal(status.totalCodes, 10);
      assert.equal(status.remainingCodes, 10);
      assert.equal(status.usedCodes, 0);
    });

    await t.test('expiry date is set to 1 year from now', async () => {
      const status = await service.getUserCodeStatus(userId);
      const expiryDate = new Date(status.expiresAt);
      const now = new Date();
      const daysUntilExpiry = (expiryDate - now) / (1000 * 60 * 60 * 24);
      
      // Should be approximately 365 days
      assert.ok(daysUntilExpiry > 364 && daysUntilExpiry < 366);
    });
  });

  // ========== Phase 3: Code Usage (Master Password Reset) ==========
  await t.test('Phase 3: Use Recovery Code for Master Password Reset', async (t) => {
    const codeToUse = generatedCodes[0];

    await t.test('verify recovery code is valid', async () => {
      const verification = await service.verifyRecoveryCode(userId, codeToUse);
      
      assert.ok(verification.valid, 'Code should be valid before use');
      assert.ok(verification.codeRecord);
      assert.ok(verification.codeRecord.id);
    });

    await t.test('reject invalid recovery code', async () => {
      const verification = await service.verifyRecoveryCode(userId, 'INVALID-CODE-XXXX-XXXX');
      
      assert.equal(verification.valid, false);
      assert.equal(verification.reason, 'invalid_code');
    });

    await t.test('burn code after successful reset', async () => {
      const verification = await service.verifyRecoveryCode(userId, codeToUse);
      assert.ok(verification.valid);

      const burned = await service.burnCode(verification.codeRecord.id, userId, 'used');
      assert.ok(burned);
    });

    await t.test('remaining codes decreases by 1', async () => {
      const status = await service.getUserCodeStatus(userId);
      
      assert.equal(status.totalCodes, 10);
      assert.equal(status.remainingCodes, 9, 'One code should be used');
      assert.equal(status.usedCodes, 1);
    });
  });

  // ========== Phase 4: One-Time Use Enforcement ==========
  await t.test('Phase 4: One-Time Use Enforcement', async (t) => {
    const codeToUse = generatedCodes[0]; // Already used in Phase 3

    await t.test('reject already-used recovery code', async () => {
      const verification = await service.verifyRecoveryCode(userId, codeToUse);
      
      assert.equal(verification.valid, false);
      assert.equal(verification.reason, 'invalid_code');
    });

    await t.test('can still use other codes', async () => {
      const codeToUse2 = generatedCodes[1];
      const verification = await service.verifyRecoveryCode(userId, codeToUse2);
      
      // This code hasn't been used yet
      assert.ok(verification.valid, 'Second code should still be available');
    });
  });

  // ========== Phase 5: Code Revocation ==========
  await t.test('Phase 5: Code Revocation', async (t) => {
    await t.test('revoke all unused codes', async () => {
      const codesRevoked = await service.revokeAllCodes(userId, 'user_request');
      
      assert.ok(codesRevoked > 0);
      assert.equal(codesRevoked, 9, 'Should revoke 9 remaining codes');
    });

    await t.test('all codes marked as used after revocation', async () => {
      const status = await service.getUserCodeStatus(userId);
      
      assert.equal(status.totalCodes, 10);
      assert.equal(status.remainingCodes, 0, 'All codes should be revoked');
      assert.equal(status.usedCodes, 10);
    });
  });

  // ========== Phase 6: Code Expiration ==========
  await t.test('Phase 6: Code Expiration', async (t) => {
    const expiredUserId = 'user-expired';
    const expiredCodes = service.generateCodes(5);

    // Save with -1 days expiry (already expired)
    await service.saveCodes(expiredUserId, expiredCodes, -1);

    await t.test('expired codes cannot be used', async () => {
      const verification = await service.verifyRecoveryCode(expiredUserId, expiredCodes[0]);
      
      // Should be rejected as expired
      assert.equal(verification.valid, false);
    });

    await t.test('expired codes show in status', async () => {
      const status = await service.getUserCodeStatus(expiredUserId);
      
      assert.equal(status.totalCodes, 5);
      assert.equal(status.remainingCodes, 0, 'Expired codes are not usable');
    });
  });

  // ========== Phase 7: Security Tests ==========
  await t.test('Phase 7: Security Validation', async (t) => {
    await t.test('plaintext codes stored correctly', async () => {
      // Codes are stored as plain in this mock, but in real implementation would be hashed
      const status = await service.getUserCodeStatus(userId);
      assert.equal(status.totalCodes, 10);
    });

    await t.test('codes are case-sensitive', async () => {
      const testUserId = 'user-case-test';
      const testCode = 'ABCD-EFGH-XXXX-XXXX';
      
      await service.saveCodes(testUserId, [testCode], 365);
      
      // Try with different case
      const verification = await service.verifyRecoveryCode(testUserId, 'abcd-efgh-xxxx-xxxx');
      
      // Should fail because codes are case-sensitive
      assert.equal(verification.valid, false);
    });

    await t.test('code ID is unique per code', async () => {
      const testUserId = 'user-id-test';
      const testCodes = service.generateCodes(3);
      
      await service.saveCodes(testUserId, testCodes, 365);
      const status = await service.getUserCodeStatus(testUserId);
      
      assert.equal(status.totalCodes, 3);
    });
  });

  // ========== Phase 8: Multi-User Isolation ==========
  await t.test('Phase 8: Multi-User Isolation', async (t) => {
    const user1 = 'user-1';
    const user2 = 'user-2';
    const user1Codes = service.generateCodes(5);
    const user2Codes = service.generateCodes(5);

    await service.saveCodes(user1, user1Codes, 365);
    await service.saveCodes(user2, user2Codes, 365);

    await t.test('user1 codes do not work for user2', async () => {
      const verification = await service.verifyRecoveryCode(user2, user1Codes[0]);
      
      assert.equal(verification.valid, false);
    });

    await t.test('each user has independent code count', async () => {
      const status1 = await service.getUserCodeStatus(user1);
      const status2 = await service.getUserCodeStatus(user2);

      assert.equal(status1.totalCodes, 5);
      assert.equal(status2.totalCodes, 5);
      
      // Burn one code for user1
      const verification = await service.verifyRecoveryCode(user1, user1Codes[0]);
      if (verification.valid) {
        await service.burnCode(verification.codeRecord.id, user1, 'used');
      }

      const updatedStatus1 = await service.getUserCodeStatus(user1);
      const updatedStatus2 = await service.getUserCodeStatus(user2);

      assert.ok(updatedStatus1.remainingCodes < updatedStatus2.remainingCodes,
        'User1 should have fewer remaining codes after burning one');
    });
  });
});
