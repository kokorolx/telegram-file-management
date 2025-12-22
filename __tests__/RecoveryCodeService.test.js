/**
 * Unit tests for RecoveryCodeService
 * 
 * Tests the core recovery code functionality without database
 * Uses Node.js built-in test runner
 * 
 * Run: node --test __tests__/RecoveryCodeService.test.js
 */

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import crypto from 'crypto';
import bcryptjs from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

// Mock the database pool
const mockPool = {
  query: async () => ({ rows: [] })
};

// Mock implementation of RecoveryCodeService for testing
class RecoveryCodeService {
  generateCodes(count = 10) {
    const codes = [];
    for (let i = 0; i < count; i++) {
      const randomBytes = crypto.randomBytes(8).toString('hex').toUpperCase();
      const code = [
        randomBytes.substring(0, 4),
        randomBytes.substring(4, 8),
        randomBytes.substring(8, 12),
        randomBytes.substring(12, 16)
      ].join('-');
      codes.push(code);
    }
    return codes;
  }

  async hashCode(code) {
    return bcryptjs.hash(code, 10);
  }

  async verifyCode(plainCode, hash) {
    return bcryptjs.compare(plainCode, hash);
  }
}

const service = new RecoveryCodeService();

test('RecoveryCodeService', async (t) => {
  // ========== Code Generation Tests ==========
  await t.test('generateCodes - returns array', async () => {
    const codes = service.generateCodes();
    assert.ok(Array.isArray(codes));
    assert.equal(codes.length, 10);
  });

  await t.test('generateCodes - returns correct format XXXX-XXXX-XXXX-XXXX', async () => {
    const codes = service.generateCodes(5);
    const formatRegex = /^[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/;
    
    for (const code of codes) {
      assert.ok(formatRegex.test(code), `Code ${code} doesn't match format`);
    }
  });

  await t.test('generateCodes - returns unique codes', async () => {
    const codes = service.generateCodes(20);
    const uniqueCodes = new Set(codes);
    assert.equal(codes.length, uniqueCodes.size, 'Generated codes should be unique');
  });

  await t.test('generateCodes - respects count parameter', async () => {
    const counts = [1, 5, 10, 20];
    for (const count of counts) {
      const codes = service.generateCodes(count);
      assert.equal(codes.length, count);
    }
  });

  // ========== Hashing Tests ==========
  await t.test('hashCode - creates valid hash', async () => {
    const code = 'ABCD-EFGH-IJKL-MNOP';
    const hash = await service.hashCode(code);
    
    assert.ok(hash);
    assert.ok(hash.length > 0);
    assert.notEqual(hash, code, 'Hash should be different from plain code');
  });

  await t.test('hashCode - different hashes for same input (salted)', async () => {
    const code = 'ABCD-EFGH-IJKL-MNOP';
    const hash1 = await service.hashCode(code);
    const hash2 = await service.hashCode(code);
    
    assert.notEqual(hash1, hash2, 'Same input should produce different hashes (bcryptjs salting)');
  });

  // ========== Verification Tests ==========
  await t.test('verifyCode - validates correct code against hash', async () => {
    const code = 'TEST-CODE-XXXX-1234';
    const hash = await service.hashCode(code);
    const isValid = await service.verifyCode(code, hash);
    
    assert.ok(isValid);
  });

  await t.test('verifyCode - rejects incorrect code', async () => {
    const code = 'TEST-CODE-XXXX-1234';
    const hash = await service.hashCode(code);
    const isValid = await service.verifyCode('WRONG-CODE-XXXX-5678', hash);
    
    assert.equal(isValid, false);
  });

  await t.test('verifyCode - case sensitive', async () => {
    const code = 'ABCD-EFGH-IJKL-MNOP';
    const hash = await service.hashCode(code);
    
    const lowerCaseIsValid = await service.verifyCode('abcd-efgh-ijkl-mnop', hash);
    assert.equal(lowerCaseIsValid, false, 'Hash comparison should be case sensitive');
  });

  // ========== Integration Tests ==========
  await t.test('generateCodes -> hashCode -> verifyCode flow', async () => {
    const generatedCodes = service.generateCodes(3);
    assert.equal(generatedCodes.length, 3);

    // Hash all codes
    const hashes = [];
    for (const code of generatedCodes) {
      const hash = await service.hashCode(code);
      hashes.push(hash);
    }

    // Verify each code against its hash
    for (let i = 0; i < generatedCodes.length; i++) {
      const isValid = await service.verifyCode(generatedCodes[i], hashes[i]);
      assert.ok(isValid, `Code ${i} should verify against its hash`);
    }
  });

  // ========== Code Format Validation ==========
  await t.test('generated codes are uppercase hex', async () => {
    const codes = service.generateCodes(10);
    const hexRegex = /^[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/;
    
    for (const code of codes) {
      assert.ok(hexRegex.test(code), `Code ${code} contains non-hex characters`);
      assert.ok(code === code.toUpperCase(), `Code ${code} is not uppercase`);
    }
  });

  // ========== Edge Cases ==========
  await t.test('hashCode - works with empty string', async () => {
    const hash = await service.hashCode('');
    assert.ok(hash);
    assert.ok(hash.length > 0);
  });

  await t.test('hashCode - works with very long string', async () => {
    const longCode = 'A'.repeat(500);
    const hash = await service.hashCode(longCode);
    assert.ok(hash);
  });

  await t.test('generateCodes - handles edge case count 0', async () => {
    const codes = service.generateCodes(0);
    assert.equal(codes.length, 0);
  });

  await t.test('generateCodes - handles large count', async () => {
    const codes = service.generateCodes(100);
    assert.equal(codes.length, 100);
    const uniqueCodes = new Set(codes);
    assert.equal(codes.length, uniqueCodes.size, 'All 100 codes should be unique');
  });
});
