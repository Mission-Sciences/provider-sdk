'use client';

import { useEffect, useState } from 'react';
import { MarketplaceSDK } from '@mission_sciences/provider-sdk';
import type { SessionData } from '@mission_sciences/provider-sdk';

const APP_ID  = '91108a6a-7f25-4b41-a20c-6a904e49048c';
// Get a real key from the GW setup page (Developer → Applications → your app → Setup). Never commit one.
const API_KEY = 'YOUR_API_KEY';

type Status = 'waiting' | 'loading' | 'active' | 'error';

export default function SessionClient() {
  const [status, setStatus] = useState<Status>('waiting');
  const [session, setSession] = useState<SessionData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const hasSession = new URLSearchParams(window.location.search).has('gwSession');
    if (!hasSession) return;

    setStatus('loading');

    const sdk = new MarketplaceSDK({
      applicationId: APP_ID,
      apiKey: API_KEY,
      environment: 'dev',
      autoStart: true,
      warningThresholdSeconds: 300,
      debug: true,
    });

    sdk.initialize()
      .then(s => {
        setSession(s);
        setStatus('active');
      })
      .catch(err => {
        setError((err as Error).message);
        setStatus('error');
      });

    return () => { sdk.destroy(); };
  }, []);

  const badgeStyle = {
    waiting: { background: '#1e293b', color: '#94a3b8', border: '1px solid #334155' },
    loading: { background: '#1e3a5f', color: '#60a5fa', border: '1px solid #2563eb' },
    active:  { background: '#14532d', color: '#4ade80', border: '1px solid #16a34a' },
    error:   { background: '#450a0a', color: '#f87171', border: '1px solid #dc2626' },
  }[status];

  const badgeText = {
    waiting: 'Waiting for session…',
    loading: 'Initializing…',
    active:  '● Session active',
    error:   'Error',
  }[status];

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      <div style={{
        background: '#1a1f2e', border: '1px solid #2d3748', borderRadius: 12,
        padding: 32, maxWidth: 480, width: '100%', color: '#e2e8f0',
      }}>
        <h1 style={{ fontSize: '1.5rem', marginBottom: 8, color: '#efc139' }}>Next.js Example</h1>
        <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: 24 }}>
          @mission_sciences/provider-sdk · environment: dev
        </p>

        <span style={{
          display: 'inline-block', padding: '4px 10px', borderRadius: 999,
          fontSize: '0.75rem', fontWeight: 600, marginBottom: 16, ...badgeStyle,
        }}>
          {badgeText}
        </span>

        <pre style={{
          background: '#0d1117', border: '1px solid #2d3748', borderRadius: 8,
          padding: 16, fontFamily: 'monospace', fontSize: '0.8rem', color: '#94a3b8',
          minHeight: 80, whiteSpace: 'pre-wrap', wordBreak: 'break-all',
        }}>
          {status === 'waiting' && 'No ?gwSession= found.\n\nVisit the setup page and launch a test session.'}
          {status === 'loading' && 'Initializing SDK…'}
          {status === 'error' && `Error: ${error}`}
          {status === 'active' && session && (
            `Session active!\n  sessionId:       ${session.sessionId}\n  durationMinutes: ${session.durationMinutes}`
          )}
        </pre>
      </div>
    </div>
  );
}
