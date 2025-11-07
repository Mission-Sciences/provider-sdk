#!/usr/bin/env node

/**
 * Generate RSA 2048-bit key pair for testing
 * Run: npm run generate-keys
 */

import { execSync } from 'child_process';
import { mkdirSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';

const KEYS_DIR = join(process.cwd(), 'keys');

console.log('🔑 Generating RSA 2048-bit key pair for testing...\n');

// Create keys directory
if (!existsSync(KEYS_DIR)) {
  mkdirSync(KEYS_DIR);
  console.log('✓ Created keys/ directory');
}

try {
  // Generate private key
  console.log('📝 Generating private key...');
  execSync(
    `openssl genrsa -out ${join(KEYS_DIR, 'test-private-key.pem')} 2048`,
    { stdio: 'inherit' }
  );

  // Generate public key
  console.log('📝 Generating public key...');
  execSync(
    `openssl rsa -in ${join(KEYS_DIR, 'test-private-key.pem')} -pubout -out ${join(KEYS_DIR, 'test-public-key.pem')}`,
    { stdio: 'inherit' }
  );

  console.log('\n✅ Key pair generated successfully!');
  console.log(`📁 Keys saved to: ${KEYS_DIR}`);
  console.log('   - test-private-key.pem (keep secret!)');
  console.log('   - test-public-key.pem (can be shared)');
  console.log('\n⚠️  Note: These keys are for development only!');
  console.log('   They are git-ignored and should NOT be used in production.\n');

} catch (error) {
  console.error('❌ Error generating keys:', error.message);
  console.log('\nMake sure OpenSSL is installed:');
  console.log('  macOS: brew install openssl');
  console.log('  Ubuntu/Debian: sudo apt-get install openssl');
  console.log('  Windows: https://slproweb.com/products/Win32OpenSSL.html');
  process.exit(1);
}
