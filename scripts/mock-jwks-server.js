#!/usr/bin/env node

/**
 * Mock JWKS server for local development
 * Serves public key in JWKS format
 * Run: node scripts/mock-jwks-server.js
 */

import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { createPublicKey } from 'crypto';

const PORT = 8080;
const KEYS_DIR = join(process.cwd(), 'keys');
const PUBLIC_KEY_PATH = join(KEYS_DIR, 'test-public-key.pem');

// Check if keys exist
if (!existsSync(PUBLIC_KEY_PATH)) {
  console.error('❌ Public key not found!');
  console.log('   Run: npm run generate-keys\n');
  process.exit(1);
}

// Read and convert public key to JWKS format
const publicKeyPEM = readFileSync(PUBLIC_KEY_PATH, 'utf8');
const publicKeyObject = createPublicKey(publicKeyPEM);
const jwk = publicKeyObject.export({ format: 'jwk' });

// Create JWKS response
const jwks = {
  keys: [
    {
      ...jwk,
      kid: 'test-key-2025-01',
      use: 'sig',
      alg: 'RS256',
    },
  ],
};

// Create HTTP server
const server = createServer((req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === '/.well-known/jwks.json') {
    console.log(`[${new Date().toISOString()}] GET /.well-known/jwks.json`);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(jwks, null, 2));
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

server.listen(PORT, () => {
  console.log('🔐 Mock JWKS Server Running\n');
  console.log(`📍 JWKS Endpoint: http://localhost:${PORT}/.well-known/jwks.json`);
  console.log(`🔑 Serving public key: ${PUBLIC_KEY_PATH}`);
  console.log('\n💡 Configure SDK with:');
  console.log(`   jwksUri: 'http://localhost:${PORT}/.well-known/jwks.json'\n`);
  console.log('Press Ctrl+C to stop\n');
});
