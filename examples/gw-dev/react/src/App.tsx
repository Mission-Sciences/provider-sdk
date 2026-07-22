import { useEffect, useState } from 'react';
import { MarketplaceSDK } from '@mission_sciences/provider-sdk';
import type { SessionData } from '@mission_sciences/provider-sdk';

const APP_ID  = '91108a6a-7f25-4b41-a20c-6a904e49048c';
// Get a real key from the GW setup page (Developer → Applications → your app → Setup). Never commit one.
const API_KEY = 'YOUR_API_KEY';

type Status = 'waiting' | 'loading' | 'active' | 'error';

export default function App() {
  const [status, setStatus] = useState<Status>('waiting');
  const [session, setSession] = useState<SessionData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasSession = new URLSearchParams(window.location.search).has('gwSession');

  useEffect(() => {
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
        setError(err.message);
        setStatus('error');
      });

    return () => { sdk.destroy(); };
  }, [hasSession]);

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>React Example</h1>
        <p style={styles.subtitle}>@mission_sciences/provider-sdk · environment: dev</p>

        <Badge status={status} />

        {status === 'waiting' && (
          <pre style={styles.log}>
            No ?gwSession= found.{'\n\n'}
            Visit the setup page and launch a test session.
          </pre>
        )}
        {status === 'loading' && <pre style={styles.log}>Initializing SDK…</pre>}
        {status === 'error' && <pre style={styles.log}>Error: {error}</pre>}
        {status === 'active' && session && (
          <pre style={styles.log}>
            Session active!{'\n'}
            {'  '}sessionId:       {session.sessionId}{'\n'}
            {'  '}durationMinutes: {session.durationMinutes}{'\n'}
          </pre>
        )}
      </div>
    </div>
  );
}

function Badge({ status }: { status: Status }) {
  const labels: Record<Status, string> = {
    waiting: 'Waiting for session…',
    loading: 'Initializing…',
    active: '● Session active',
    error: 'Error',
  };
  const colors: Record<Status, { bg: string; color: string; border: string }> = {
    waiting: { bg: '#1e293b', color: '#94a3b8', border: '#334155' },
    loading: { bg: '#1e3a5f', color: '#60a5fa', border: '#2563eb' },
    active:  { bg: '#14532d', color: '#4ade80', border: '#16a34a' },
    error:   { bg: '#450a0a', color: '#f87171', border: '#dc2626' },
  };
  const c = colors[status];
  return (
    <span style={{
      display: 'inline-block', padding: '4px 10px', borderRadius: 999,
      fontSize: '0.75rem', fontWeight: 600, marginBottom: 16,
      background: c.bg, color: c.color, border: `1px solid ${c.border}`,
    }}>
      {labels[status]}
    </span>
  );
}

const styles = {
  page: {
    background: '#0f1117', minHeight: '100vh', display: 'flex',
    alignItems: 'center', justifyContent: 'center', padding: 24,
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  card: {
    background: '#1a1f2e', border: '1px solid #2d3748', borderRadius: 12,
    padding: 32, maxWidth: 480, width: '100%', color: '#e2e8f0',
  },
  title: { fontSize: '1.5rem', marginBottom: 8, color: '#efc139' },
  subtitle: { color: '#94a3b8', fontSize: '0.875rem', marginBottom: 24 },
  log: {
    background: '#0d1117', border: '1px solid #2d3748', borderRadius: 8,
    padding: 16, fontFamily: 'monospace', fontSize: '0.8rem', color: '#94a3b8',
    minHeight: 80, whiteSpace: 'pre-wrap' as const, wordBreak: 'break-all' as const,
  },
} as const;
