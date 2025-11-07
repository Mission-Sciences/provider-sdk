import React, { useState } from 'react';
import { useMarketplaceSession } from './useMarketplaceSession';

export function App() {
  const [extendMinutes, setExtendMinutes] = useState(15);
  const [showExtendDialog, setShowExtendDialog] = useState(false);

  const {
    session,
    loading,
    error,
    formattedTimeWithHours,
    isTimerRunning,
    pauseTimer,
    resumeTimer,
    endSession,
    extendSession,
    completeSession,
    isHeartbeatEnabled,
    isTabSyncEnabled,
  } = useMarketplaceSession({
    apiEndpoint: 'http://localhost:3000',
    applicationId: 'app_test_123',
    marketplaceUrl: 'https://d3p2yqofgy75sz.cloudfront.net/',  // Configure marketplace redirect URL
    debug: true,
    autoStart: true,
    warningThresholdSeconds: 300,
    // Phase 2 Features
    enableHeartbeat: true,
    heartbeatIntervalSeconds: 30,
    enableTabSync: true,
    pauseOnHidden: true,
    useBackendValidation: true,  // Use backend validation instead of JWKS (browser-friendly!)
  });

  const handleExtendSession = async () => {
    try {
      await extendSession(extendMinutes);
      setShowExtendDialog(false);
      alert(`Session extended by ${extendMinutes} minutes!`);
    } catch (error) {
      alert(`Failed to extend: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleCompleteSession = async () => {
    if (!confirm('Complete session early? This will end your session and return you to the marketplace.')) {
      return;
    }

    try {
      // Calculate actual usage
      const now = Math.floor(Date.now() / 1000);
      const actualUsageSeconds = now - (session?.startTime || 0);
      const actualUsageMinutes = Math.ceil(actualUsageSeconds / 60);

      await completeSession(actualUsageMinutes);
    } catch (error) {
      alert(`Failed to complete: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.spinner} />
          <h2>Initializing Session</h2>
          <p>Validating JWT and starting session...</p>
          {isHeartbeatEnabled && <p style={{ fontSize: '12px', color: '#666' }}>Heartbeat enabled</p>}
          {isTabSyncEnabled && <p style={{ fontSize: '12px', color: '#666' }}>Multi-tab sync enabled</p>}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={{ ...styles.card, ...styles.errorCard }}>
          <h2>Session Error</h2>
          <p>{error}</p>
          <button
            style={styles.button}
            onClick={() => {
              // Note: SDK's ending modal would be shown here if SDK was initialized,
              // but in error state we just redirect since SDK failed to initialize
              window.location.href = 'https://d3p2yqofgy75sz.cloudfront.net/';
            }}
          >
            Return to Marketplace
          </button>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* Header */}
        <div style={styles.header}>
          <h1 style={styles.title}>Session Dashboard</h1>
          <div style={styles.badges}>
            {isHeartbeatEnabled && (
              <span style={styles.badge}>❤️ Heartbeat Active</span>
            )}
            {isTabSyncEnabled && (
              <span style={styles.badge}>🔄 Multi-Tab Sync</span>
            )}
          </div>
        </div>

        {/* Timer Card */}
        <div style={styles.timerCard}>
          <div style={styles.timerLabel}>Time Remaining</div>
          <div style={styles.timerValue}>{formattedTimeWithHours}</div>
          <div style={styles.timerStatus}>
            {isTimerRunning ? '▶️ Running' : '⏸️ Paused'}
          </div>
        </div>

        {/* Session Info Grid */}
        <div style={styles.infoGrid}>
          <div style={styles.infoItem}>
            <div style={styles.infoLabel}>Session ID</div>
            <div style={styles.infoValue}>{session.sessionId.substring(0, 16)}...</div>
          </div>
          <div style={styles.infoItem}>
            <div style={styles.infoLabel}>User ID</div>
            <div style={styles.infoValue}>{session.userId}</div>
          </div>
          <div style={styles.infoItem}>
            <div style={styles.infoLabel}>Organization</div>
            <div style={styles.infoValue}>{session.orgId}</div>
          </div>
          <div style={styles.infoItem}>
            <div style={styles.infoLabel}>Duration</div>
            <div style={styles.infoValue}>{session.durationMinutes} min</div>
          </div>
        </div>

        {/* Timer Controls */}
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Timer Controls</h3>
          <div style={styles.buttonGroup}>
            {isTimerRunning ? (
              <button style={{ ...styles.button, ...styles.secondaryButton }} onClick={pauseTimer}>
                ⏸️ Pause
              </button>
            ) : (
              <button style={{ ...styles.button, ...styles.primaryButton }} onClick={resumeTimer}>
                ▶️ Resume
              </button>
            )}
          </div>
        </div>

        {/* Phase 2: Session Management */}
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Phase 2 Features</h3>
          <div style={styles.buttonGroup}>
            <button
              style={{ ...styles.button, ...styles.successButton }}
              onClick={() => setShowExtendDialog(!showExtendDialog)}
            >
              ⏰ Extend Session
            </button>
            <button
              style={{ ...styles.button, ...styles.warningButton }}
              onClick={handleCompleteSession}
            >
              ✅ Complete Early
            </button>
            <button
              style={{ ...styles.button, ...styles.dangerButton }}
              onClick={() => {
                if (confirm('End session now?')) {
                  endSession();
                }
              }}
            >
              🛑 End Session
            </button>
          </div>

          {/* Extension Dialog */}
          {showExtendDialog && (
            <div style={styles.extendDialog}>
              <h4>Extend Session</h4>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>Additional Minutes:</label>
                <select
                  value={extendMinutes}
                  onChange={(e) => setExtendMinutes(Number(e.target.value))}
                  style={styles.select}
                >
                  <option value={5}>5 minutes</option>
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={60}>60 minutes</option>
                </select>
              </div>
              <div style={styles.buttonGroup}>
                <button style={{ ...styles.button, ...styles.primaryButton }} onClick={handleExtendSession}>
                  Confirm
                </button>
                <button
                  style={{ ...styles.button, ...styles.secondaryButton }}
                  onClick={() => setShowExtendDialog(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Phase 2 Info */}
        <div style={styles.phase2Info}>
          <h4 style={{ marginTop: 0 }}>Phase 2 Features Active:</h4>
          <ul style={{ marginLeft: '20px' }}>
            <li>❤️ <strong>Heartbeat</strong>: {isHeartbeatEnabled ? 'Sending every 30s' : 'Disabled'}</li>
            <li>🔄 <strong>Tab Sync</strong>: {isTabSyncEnabled ? 'Coordinating across tabs' : 'Disabled'}</li>
            <li>👁️ <strong>Pause on Hidden</strong>: Timer pauses when tab is hidden</li>
            <li>⏰ <strong>Extension</strong>: Can extend session via backend API</li>
            <li>✅ <strong>Early Completion</strong>: Can end early with refund</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  card: {
    background: 'white',
    borderRadius: '16px',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
    padding: '40px',
    maxWidth: '700px',
    width: '100%',
  },
  header: {
    marginBottom: '30px',
  },
  title: {
    color: '#333',
    marginBottom: '10px',
    fontSize: '28px',
    margin: 0,
  },
  badges: {
    display: 'flex',
    gap: '10px',
    marginTop: '10px',
  },
  badge: {
    background: '#e8f5e9',
    color: '#2e7d32',
    padding: '4px 12px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '600',
  },
  timerCard: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    borderRadius: '12px',
    padding: '25px',
    marginBottom: '25px',
    textAlign: 'center',
    color: 'white',
  },
  timerLabel: {
    fontSize: '12px',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    opacity: 0.9,
    marginBottom: '10px',
  },
  timerValue: {
    fontSize: '48px',
    fontWeight: 'bold',
    marginBottom: '10px',
  },
  timerStatus: {
    fontSize: '14px',
    opacity: 0.8,
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '15px',
    marginBottom: '25px',
  },
  infoItem: {
    background: '#f8f9fa',
    borderRadius: '8px',
    padding: '15px',
  },
  infoLabel: {
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    color: '#888',
    marginBottom: '5px',
  },
  infoValue: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#333',
    wordBreak: 'break-all',
  },
  section: {
    marginBottom: '25px',
    paddingBottom: '25px',
    borderBottom: '1px solid #e0e0e0',
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#333',
    marginBottom: '15px',
  },
  buttonGroup: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
  },
  button: {
    flex: '1 1 auto',
    minWidth: '120px',
    padding: '12px 20px',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  primaryButton: {
    background: '#667eea',
    color: 'white',
  },
  secondaryButton: {
    background: '#e0e0e0',
    color: '#333',
  },
  successButton: {
    background: '#10b981',
    color: 'white',
  },
  warningButton: {
    background: '#f59e0b',
    color: 'white',
  },
  dangerButton: {
    background: '#ef4444',
    color: 'white',
  },
  errorCard: {
    background: '#fee',
    border: '2px solid #fcc',
    color: '#c00',
  },
  spinner: {
    border: '4px solid #f3f3f3',
    borderTop: '4px solid #667eea',
    borderRadius: '50%',
    width: '50px',
    height: '50px',
    animation: 'spin 1s linear infinite',
    margin: '0 auto 20px',
  },
  extendDialog: {
    background: '#f8f9fa',
    padding: '20px',
    borderRadius: '8px',
    marginTop: '15px',
  },
  select: {
    width: '100%',
    padding: '10px',
    borderRadius: '4px',
    border: '1px solid #ddd',
    fontSize: '14px',
  },
  phase2Info: {
    background: '#e8f5e9',
    padding: '20px',
    borderRadius: '8px',
    fontSize: '14px',
    color: '#2e7d32',
    marginTop: '25px',
  },
};
