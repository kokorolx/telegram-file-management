#!/usr/bin/env node

/**
 * Test runner for Recovery Code system
 * Runs all test suites and provides summary
 * 
 * Usage: npm run test:all-recovery
 * Or: node __tests__/run-all-tests.js
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
  bold: '\x1b[1m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function header(title) {
  log(`\n${'═'.repeat(70)}`, 'blue');
  log(`  ${title}`, 'bold');
  log(`${'═'.repeat(70)}\n`, 'blue');
}

async function runTest(testFile, description) {
  return new Promise((resolve) => {
    log(`▶ ${description}...`, 'yellow');
    
    const process = spawn('node', ['--test', `__tests__/${testFile}`], {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit'
    });

    process.on('close', (code) => {
      if (code === 0) {
        log(`✓ ${description} passed\n`, 'green');
        resolve({ success: true, file: testFile });
      } else {
        log(`✗ ${description} failed\n`, 'red');
        resolve({ success: false, file: testFile });
      }
    });

    process.on('error', (err) => {
      log(`✗ ${description} error: ${err.message}\n`, 'red');
      resolve({ success: false, file: testFile });
    });
  });
}

async function main() {
  header('Recovery Code System - Test Suite');

  const testSuites = [
    {
      file: 'RecoveryCodeService.test.js',
      description: 'RecoveryCodeService Unit Tests'
    },
    {
      file: 'RecoveryCodeAPI.test.js',
      description: 'API Endpoints Contract Tests'
    },
    {
      file: 'RecoveryCodeFlow.test.js',
      description: 'Complete Lifecycle Integration Tests'
    }
  ];

  const results = [];

  for (const suite of testSuites) {
    const result = await runTest(suite.file, suite.description);
    results.push(result);
  }

  // Summary
  header('Test Summary');

  const passed = results.filter(r => r.success).length;
  const total = results.length;

  log(`Tests Run: ${total}`, 'blue');
  log(`Passed: ${passed}`, 'green');
  log(`Failed: ${total - passed}`, passed === total ? 'green' : 'red');

  log(`\n${'─'.repeat(70)}`, 'gray');

  if (passed === total) {
    log('✓ All tests passed!', 'green');
    log('\nRecovery Code System is ready for Phase 7: Documentation\n', 'green');
    process.exit(0);
  } else {
    log('✗ Some tests failed. Review the output above.', 'red');
    log('\nFailing tests:', 'red');
    results
      .filter(r => !r.success)
      .forEach(r => log(`  • ${r.file}`, 'red'));
    log('');
    process.exit(1);
  }
}

main().catch(err => {
  log(`Fatal error: ${err.message}`, 'red');
  console.error(err);
  process.exit(1);
});
