import { useEffect, useState, useCallback, useRef } from 'react';
import { MarketplaceSDK, SessionData, SDKConfig } from '@marketplace/provider-sdk';

export interface UseMarketplaceSessionOptions extends SDKConfig {
  onSessionStart?: (data: SessionData) => void;
  onSessionWarning?: (data: { remainingSeconds: number }) => void;
  onSessionEnd?: () => void;
  onError?: (error: Error) => void;
}

export interface UseMarketplaceSessionReturn {
  // Session state
  session: SessionData | null;
  loading: boolean;
  error: string | null;

  // Timer state
  remainingTime: number;
  formattedTime: string;
  formattedTimeWithHours: string;
  isTimerRunning: boolean;

  // Timer controls
  startTimer: () => void;
  pauseTimer: () => void;
  resumeTimer: () => void;

  // Session controls
  endSession: () => void;

  // Phase 2 features
  extendSession: (minutes: number) => Promise<void>;
  completeSession: (actualUsageMinutes?: number) => Promise<void>;

  // Phase 2 state
  isHeartbeatEnabled: boolean;
  isTabSyncEnabled: boolean;
}

/**
 * React Hook for Marketplace Session Management (Phase 2)
 *
 * Enhanced with:
 * - Heartbeat system
 * - Multi-tab synchronization
 * - Session extension
 * - Session completion
 * - Visibility API integration
 *
 * @example
 * ```tsx
 * function MyApp() {
 *   const {
 *     session,
 *     loading,
 *     error,
 *     formattedTime,
 *     pauseTimer,
 *     resumeTimer,
 *     endSession,
 *     extendSession,
 *   } = useMarketplaceSession({
 *     apiEndpoint: 'http://localhost:3000',
 *     applicationId: 'my-app',
 *     enableHeartbeat: true,
 *     enableTabSync: true,
 *     pauseOnHidden: true,
 *     debug: true,
 *   });
 *
 *   if (loading) return <div>Loading...</div>;
 *   if (error) return <div>Error: {error}</div>;
 *
 *   return (
 *     <div>
 *       <h1>My App</h1>
 *       <p>Time remaining: {formattedTime}</p>
 *       <button onClick={pauseTimer}>Pause</button>
 *       <button onClick={resumeTimer}>Resume</button>
 *       <button onClick={() => extendSession(15)}>Extend +15min</button>
 *       <button onClick={endSession}>End Session</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useMarketplaceSession(
  options: UseMarketplaceSessionOptions
): UseMarketplaceSessionReturn {
  // Session state
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Timer state
  const [remainingTime, setRemainingTime] = useState(0);
  const [formattedTime, setFormattedTime] = useState('0:00');
  const [formattedTimeWithHours, setFormattedTimeWithHours] = useState('0:00:00');
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  // SDK reference
  const sdkRef = useRef<MarketplaceSDK | null>(null);
  const intervalRef = useRef<number | null>(null);

  // Phase 2 state
  const isHeartbeatEnabled = options.enableHeartbeat ?? false;
  const isTabSyncEnabled = options.enableTabSync ?? false;

  // Initialize SDK
  useEffect(() => {
    const initializeSDK = async () => {
      try {
        // Create SDK instance with Phase 2 features
        const sdk = new MarketplaceSDK({
          jwksUri: options.jwksUri,
          apiEndpoint: options.apiEndpoint || 'http://localhost:3000',
          debug: options.debug,
          autoStart: options.autoStart,
          warningThresholdSeconds: options.warningThresholdSeconds,
          customStyles: options.customStyles,
          applicationId: options.applicationId,
          // Phase 2 features
          enableHeartbeat: options.enableHeartbeat ?? false,
          heartbeatIntervalSeconds: options.heartbeatIntervalSeconds ?? 30,
          enableTabSync: options.enableTabSync ?? false,
          pauseOnHidden: options.pauseOnHidden ?? false,
          useBackendValidation: options.useBackendValidation ?? false,
        });

        // Register event handlers
        sdk.on('onSessionStart', (data) => {
          setSession(data);
          setLoading(false);
          setIsTimerRunning(sdk.isTimerRunning());
          options.onSessionStart?.(data);
        });

        sdk.on('onSessionWarning', (data) => {
          options.onSessionWarning?.(data);
        });

        sdk.on('onSessionEnd', () => {
          setIsTimerRunning(false);
          options.onSessionEnd?.();
        });

        sdk.on('onError', (err) => {
          setError(err.message);
          setLoading(false);
          options.onError?.(err);
        });

        // Store SDK reference
        sdkRef.current = sdk;

        // Initialize session
        await sdk.initialize();

        // Start interval to update timer display
        intervalRef.current = window.setInterval(() => {
          if (sdkRef.current) {
            setRemainingTime(sdkRef.current.getRemainingTime());
            setFormattedTime(sdkRef.current.getFormattedTime());
            setFormattedTimeWithHours(sdkRef.current.getFormattedTimeWithHours());
            setIsTimerRunning(sdkRef.current.isTimerRunning());
          }
        }, 1000);

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        setLoading(false);
      }
    };

    initializeSDK();

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (sdkRef.current) {
        sdkRef.current.destroy();
      }
    };
  }, []); // Empty deps - only initialize once

  // Timer control functions
  const startTimer = useCallback(() => {
    sdkRef.current?.startTimer();
    setIsTimerRunning(true);
  }, []);

  const pauseTimer = useCallback(() => {
    sdkRef.current?.pauseTimer();
    setIsTimerRunning(false);
  }, []);

  const resumeTimer = useCallback(() => {
    sdkRef.current?.resumeTimer();
    setIsTimerRunning(true);
  }, []);

  const endSession = useCallback(() => {
    sdkRef.current?.endSession();
    setIsTimerRunning(false);
  }, []);

  // Phase 2: Session extension
  const extendSession = useCallback(async (minutes: number) => {
    if (!sdkRef.current) {
      throw new Error('SDK not initialized');
    }
    await sdkRef.current.extendSession(minutes);
  }, []);

  // Phase 2: Session completion
  const completeSession = useCallback(async (actualUsageMinutes?: number) => {
    if (!sdkRef.current) {
      throw new Error('SDK not initialized');
    }
    await sdkRef.current.completeSession(actualUsageMinutes);
  }, []);

  return {
    // Session state
    session,
    loading,
    error,

    // Timer state
    remainingTime,
    formattedTime,
    formattedTimeWithHours,
    isTimerRunning,

    // Timer controls
    startTimer,
    pauseTimer,
    resumeTimer,

    // Session controls
    endSession,

    // Phase 2 features
    extendSession,
    completeSession,

    // Phase 2 state
    isHeartbeatEnabled,
    isTabSyncEnabled,
  };
}
