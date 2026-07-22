#!/usr/bin/env node

/**
 * Generate test JWT for development
 * Run: npm run generate-jwt
 */

import { SignJWT, importPKCS8 } from 'jose';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const KEYS_DIR = join(process.cwd(), 'keys');
const PRIVATE_KEY_PATH = join(KEYS_DIR, 'test-private-key.pem');

// Check if keys exist
if (!existsSync(PRIVATE_KEY_PATH)) {
  console.error('❌ Private key not found!');
  console.log('   Run: npm run generate-keys\n');
  process.exit(1);
}

// Read private key
const privateKey = readFileSync(PRIVATE_KEY_PATH, 'utf8');

// Generate test claims
const now = Math.floor(Date.now() / 1000);

// Parse duration argument - supports minutes or seconds with 's' suffix
// Examples: '60' = 60 minutes, '30s' = 30 seconds, '90s' = 90 seconds
let durationSeconds;
let durationMinutes;
const arg = process.argv[2] || '60';

if (arg.toLowerCase().endsWith('s')) {
  // Seconds mode: '30s' = 30 seconds
  durationSeconds = parseInt(arg);
  durationMinutes = Math.ceil(durationSeconds / 60);
} else {
  // Minutes mode (default): '60' = 60 minutes
  durationMinutes = parseInt(arg);
  durationSeconds = durationMinutes * 60;
}

const claims = {
  sessionId: 'sess_' + Math.random().toString(36).substring(2, 15),
  applicationId: 'app_test_123',
  userId: 'user_test_456',
  orgId: 'org_test_789',
  startTime: now,
  durationMinutes: durationMinutes,
};

// Sign token
try {
  const privateKeyObject = await importPKCS8(privateKey, 'RS256');

  const token = await new SignJWT(claims)
    .setProtectedHeader({
      alg: 'RS256',
      kid: 'test-key-2025-01',
    })
    .setIssuedAt(now)
    .setIssuer('generalwisdom.com')
    .setSubject('user_test_456')
    .setExpirationTime(now + durationSeconds)
    .sign(privateKeyObject);

  const fullClaims = {
    ...claims,
    iat: now,
    exp: now + durationSeconds,
    iss: 'generalwisdom.com',
    sub: 'user_test_456',
  };

  console.log('🎟️  Test JWT Generated\n');
  console.log('📋 Claims:');
  console.log(JSON.stringify(fullClaims, null, 2));
  console.log('\n🔗 JWT Token:');
  console.log(token);
  console.log('\n📝 Test URLs:');
  console.log(`  React (Phase 2):  http://localhost:3000/provider?gwSession=${token}`);
  console.log(`  Vanilla JS:       http://localhost:3000/example?gwSession=${token}`);

  // Display duration based on input format
  if (arg.toLowerCase().endsWith('s')) {
    console.log('\n⏰ Valid for:', durationSeconds, 'seconds');
  } else {
    console.log('\n⏰ Valid for:', durationMinutes, 'minutes');
  }
  console.log('🕐 Expires at:', new Date(fullClaims.exp * 1000).toISOString());
  console.log('\n💡 Tips:');
  console.log('  - Use React URL to test Phase 2 features (heartbeat, multi-tab, extension)');
  console.log('  - Click "Preview Warning Modal" button to see NEW STYLING immediately!');
  console.log('  - Or wait for automatic warning (shows when 4 minutes remain)');
  console.log('\n🎨 Want to see themes? Visit: http://localhost:3000/theme-demo (no JWT needed!)\n');

} catch (error) {
  console.error('❌ Error generating JWT:', error.message);
  process.exit(1);
}
