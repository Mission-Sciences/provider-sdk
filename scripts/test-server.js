#!/usr/bin/env node

/**
 * All-in-one test server for SDK development
 * Serves both the JWKS endpoint and the example app
 * Run: npm run test-server
 */

import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createPublicKey } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 3000;
const KEYS_DIR = join(__dirname, '..', 'keys');
const PUBLIC_KEY_PATH = join(KEYS_DIR, 'test-public-key.pem');
const DIST_DIR = join(__dirname, '..', 'dist');
const EXAMPLES_DIR = join(__dirname, '..', 'examples');

// Check if keys exist
if (!existsSync(PUBLIC_KEY_PATH)) {
  console.error('❌ Public key not found!');
  console.log('   Run: npm run generate-keys\n');
  process.exit(1);
}

// Check if dist exists
if (!existsSync(DIST_DIR)) {
  console.error('❌ SDK not built!');
  console.log('   Run: npm run build\n');
  process.exit(1);
}

// Read and convert public key to JWKS format
const publicKeyPEM = readFileSync(PUBLIC_KEY_PATH, 'utf8');
const publicKeyObject = createPublicKey(publicKeyPEM);
const jwk = publicKeyObject.export({ format: 'jwk' });

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

// MIME types
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.map': 'application/json',
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

  // JWKS endpoint
  if (req.url === '/.well-known/jwks.json') {
    console.log(`[${new Date().toISOString()}] GET /.well-known/jwks.json`);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(jwks, null, 2));
    return;
  }

  // Root - redirect to example
  if (req.url === '/') {
    res.writeHead(302, { 'Location': '/example' });
    res.end();
    return;
  }

  // Example app
  if (req.url === '/example' || req.url === '/example/') {
    const htmlPath = join(EXAMPLES_DIR, 'vanilla-js', 'index.html');
    const html = readFileSync(htmlPath, 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
    return;
  }

  // Provider simulation app
  if (req.url === '/provider' || req.url === '/provider/' || req.url.startsWith('/provider?')) {
    const htmlPath = join(EXAMPLES_DIR, 'provider-simulation', 'existing-app.html');
    const html = readFileSync(htmlPath, 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
    return;
  }

  // Serve SDK files from dist/
  if (req.url.startsWith('/dist/')) {
    const filePath = join(__dirname, '..', req.url);
    try {
      const content = readFileSync(filePath);
      const ext = req.url.substring(req.url.lastIndexOf('.'));
      const contentType = mimeTypes[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
      console.log(`[${new Date().toISOString()}] GET ${req.url}`);
      return;
    } catch (error) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'text/html' });
  res.end(`
    <html>
      <body>
        <h1>404 - Not Found</h1>
        <p>Try <a href="/example">the example app</a></p>
      </body>
    </html>
  `);
});

server.listen(PORT, () => {
  console.log('🚀 Marketplace SDK Test Server Running!\n');
  console.log('📍 Endpoints:');
  console.log(`   Simple Example:      http://localhost:${PORT}/example`);
  console.log(`   Provider Simulation: http://localhost:${PORT}/provider`);
  console.log(`   JWKS:                http://localhost:${PORT}/.well-known/jwks.json`);
  console.log('\n💡 Next Steps:');
  console.log('   1. Generate a test JWT:');
  console.log('      npm run generate-jwt 60');
  console.log('\n   2. Copy the JWT token from the output');
  console.log('\n   3. Open in browser:');
  console.log(`      http://localhost:${PORT}/provider?gwSession=<YOUR_JWT>`);
  console.log('\n   4. See how a real provider app would integrate!\n');
  console.log('Press Ctrl+C to stop\n');
});
