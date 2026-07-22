#!/usr/bin/env node

/**
 * Enhanced test server with Phase 2 backend mocks
 * Mocks: heartbeat, validation, completion, renewal endpoints
 * Run: npm run test-server-p2
 */

import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createPublicKey } from 'crypto';
import { jwtVerify, importSPKI } from 'jose';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 3000;
const KEYS_DIR = join(__dirname, '..', 'keys');
const PUBLIC_KEY_PATH = join(KEYS_DIR, 'test-public-key.pem');
const PRIVATE_KEY_PATH = join(KEYS_DIR, 'test-private-key.pem');
const DIST_DIR = join(__dirname, '..', 'dist');
const EXAMPLES_DIR = join(__dirname, '..', 'examples');

// Check if keys exist
if (!existsSync(PUBLIC_KEY_PATH)) {
  console.error('❌ Public key not found! Run: npm run generate-keys\n');
  process.exit(1);
}

if (!existsSync(DIST_DIR)) {
  console.error('❌ SDK not built! Run: npm run build\n');
  process.exit(1);
}

// Load keys
const publicKeyPEM = readFileSync(PUBLIC_KEY_PATH, 'utf8');
const privateKeyPEM = readFileSync(PRIVATE_KEY_PATH, 'utf8');
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

// In-memory session state for testing
const sessionState = new Map();

// MIME types
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.map': 'application/json',
};

// Helper: Parse request body
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk.toString()));
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
  });
}

// Helper: Verify JWT using jose
let publicKeyForJose;
async function verifyJWT(token) {
  try {
    // Lazy load the public key for jose
    if (!publicKeyForJose) {
      publicKeyForJose = await importSPKI(publicKeyPEM, 'RS256');
    }

    const { payload } = await jwtVerify(token, publicKeyForJose, {
      algorithms: ['RS256'],
      issuer: 'generalwisdom.com',
    });
    return { valid: true, decoded: payload };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

// Helper: Extract Bearer token
function extractToken(req) {
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) {
    return null;
  }
  return auth.substring(7);
}

// Create HTTP server
const server = createServer(async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);

  // ========================================
  // JWKS Endpoint
  // ========================================
  if (req.url === '/.well-known/jwks.json') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(jwks, null, 2));
    return;
  }

  // ========================================
  // Phase 2: Session Validation
  // ========================================
  if (req.url === '/sessions/validate' && req.method === 'POST') {
    const token = extractToken(req);
    if (!token) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ valid: false, error: 'Missing authorization token' }));
      return;
    }

    const verification = await verifyJWT(token);
    if (!verification.valid) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ valid: false, error: verification.error }));
      return;
    }

    const decoded = verification.decoded;
    const now = Math.floor(Date.now() / 1000);
    const remainingSeconds = decoded.exp - now;

    // Store/update session state
    sessionState.set(decoded.sessionId, {
      sessionId: decoded.sessionId,
      userId: decoded.userId,
      orgId: decoded.orgId,
      applicationId: decoded.applicationId,
      expiresAt: decoded.exp,
      lastHeartbeat: now,
      status: remainingSeconds > 0 ? 'active' : 'expired',
    });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      valid: true,
      session: sessionState.get(decoded.sessionId),
      remaining_seconds: Math.max(0, remainingSeconds),
    }));
    return;
  }

  // ========================================
  // Phase 2: Heartbeat
  // ========================================
  const heartbeatMatch = req.url.match(/^\/sessions\/([^/]+)\/heartbeat$/);
  if (heartbeatMatch && req.method === 'POST') {
    const sessionId = heartbeatMatch[1];
    const token = extractToken(req);

    if (!token) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing authorization token' }));
      return;
    }

    const verification = await verifyJWT(token);
    if (!verification.valid) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: verification.error }));
      return;
    }

    const body = await parseBody(req);
    const now = Math.floor(Date.now() / 1000);
    const decoded = verification.decoded;
    const remainingSeconds = decoded.exp - now;

    // Update session heartbeat
    if (sessionState.has(sessionId)) {
      const session = sessionState.get(sessionId);
      session.lastHeartbeat = now;
      session.status = remainingSeconds > 0 ? 'active' : 'expired';
      sessionState.set(sessionId, session);
    }

    console.log(`  ❤️  Heartbeat received for session ${sessionId} (${remainingSeconds}s remaining)`);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      acknowledged: true,
      remaining_seconds: Math.max(0, remainingSeconds),
      status: remainingSeconds > 0 ? 'active' : 'expired',
    }));
    return;
  }

  // ========================================
  // Phase 2: Session Completion
  // ========================================
  const completeMatch = req.url.match(/^\/sessions\/([^/]+)\/complete$/);
  if (completeMatch && req.method === 'POST') {
    const sessionId = completeMatch[1];
    const token = extractToken(req);

    if (!token) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing authorization token' }));
      return;
    }

    const verification = await verifyJWT(token);
    if (!verification.valid) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: verification.error }));
      return;
    }

    const body = await parseBody(req);
    const decoded = verification.decoded;
    const actualUsageMinutes = body.actual_usage_minutes || 0;
    const allocatedMinutes = decoded.durationMinutes;

    // Calculate refund (mock calculation)
    const unusedMinutes = Math.max(0, allocatedMinutes - actualUsageMinutes);
    const tokensRefunded = Math.floor(unusedMinutes * 5); // 5 tokens per minute (mock)
    const finalCost = Math.floor(actualUsageMinutes * 5);

    // Update session state
    if (sessionState.has(sessionId)) {
      const session = sessionState.get(sessionId);
      session.status = 'completed';
      session.completedAt = Math.floor(Date.now() / 1000);
      sessionState.set(sessionId, session);
    }

    console.log(`  ✅ Session ${sessionId} completed - Refund: ${tokensRefunded} tokens`);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      session_id: sessionId,
      tokens_refunded: tokensRefunded,
      final_cost: finalCost,
      actual_usage_minutes: actualUsageMinutes,
    }));
    return;
  }

  // ========================================
  // Phase 2: Session Renewal/Extension
  // ========================================
  const renewMatch = req.url.match(/^\/sessions\/([^/]+)\/renew$/);
  if (renewMatch && req.method === 'PUT') {
    const sessionId = renewMatch[1];
    const token = extractToken(req);

    if (!token) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing authorization token' }));
      return;
    }

    const verification = await verifyJWT(token);
    if (!verification.valid) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: verification.error }));
      return;
    }

    const body = await parseBody(req);
    const additionalMinutes = body.additional_minutes || 0;
    const decoded = verification.decoded;

    // Calculate new expiration
    const newExpiresAt = decoded.exp + (additionalMinutes * 60);
    const additionalCost = additionalMinutes * 5; // 5 tokens per minute (mock)
    const totalTokensSpent = decoded.tokensConsumed + additionalCost;

    // Update session state
    if (sessionState.has(sessionId)) {
      const session = sessionState.get(sessionId);
      session.expiresAt = newExpiresAt;
      sessionState.set(sessionId, session);
    }

    console.log(`  🔄 Session ${sessionId} extended by ${additionalMinutes} minutes`);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      session_id: sessionId,
      new_expires_at: newExpiresAt,
      additional_cost: additionalCost,
      total_tokens_spent: totalTokensSpent,
    }));
    return;
  }

  // ========================================
  // Static File Serving
  // ========================================

  // Root - redirect to example
  if (req.url === '/') {
    res.writeHead(302, { 'Location': '/example' });
    res.end();
    return;
  }

  // Example app
  if (req.url === '/example' || req.url.startsWith('/example?')) {
    const htmlPath = join(EXAMPLES_DIR, 'vanilla-js', 'index.html');
    const html = readFileSync(htmlPath, 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
    return;
  }

  // React Phase 2 Example
  if (req.url === '/provider' || req.url.startsWith('/provider?')) {
    const htmlPath = join(EXAMPLES_DIR, 'react', 'index.html');
    const html = readFileSync(htmlPath, 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
    return;
  }

  // Theme Demo
  if (req.url === '/theme-demo') {
    const htmlPath = join(EXAMPLES_DIR, 'theme-demo.html');
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
      <body style="font-family: sans-serif; padding: 40px; max-width: 600px; margin: 0 auto;">
        <h1>404 - Not Found</h1>
        <p style="margin: 20px 0;">Available pages:</p>
        <ul style="line-height: 2;">
          <li><a href="/example">Simple Example</a></li>
          <li><a href="/provider">Provider Simulation (Phase 2)</a></li>
          <li><a href="/theme-demo">🎨 Theme Demo (NEW!)</a></li>
        </ul>
      </body>
    </html>
  `);
});

server.listen(PORT, () => {
  console.log('🚀 Marketplace SDK Test Server (Phase 2) Running!\n');
  console.log('📍 Endpoints:');
  console.log(`   Simple Example:      http://localhost:${PORT}/example`);
  console.log(`   Provider Simulation: http://localhost:${PORT}/provider`);
  console.log(`   🎨 Theme Demo:        http://localhost:${PORT}/theme-demo`);
  console.log(`   JWKS:                http://localhost:${PORT}/.well-known/jwks.json`);
  console.log('\n🔥 Phase 2 Mock Endpoints:');
  console.log(`   POST /sessions/validate         - Validate JWT`);
  console.log(`   POST /sessions/:id/heartbeat    - Send heartbeat`);
  console.log(`   POST /sessions/:id/complete     - Complete session`);
  console.log(`   PUT  /sessions/:id/renew        - Extend session`);
  console.log('\n💡 Next Steps:');
  console.log('   1. Check out the new theme system:');
  console.log(`      http://localhost:${PORT}/theme-demo`);
  console.log('\n   2. Generate a test JWT:');
  console.log('      npm run generate-jwt 60');
  console.log('\n   3. Open in browser:');
  console.log(`      http://localhost:${PORT}/provider?gwSession=<YOUR_JWT>`);
  console.log('\n   4. Test Phase 2 features!');
  console.log('      - Heartbeat every 30s');
  console.log('      - Session extension');
  console.log('      - Session completion\n');
  console.log('Press Ctrl+C to stop\n');
});
