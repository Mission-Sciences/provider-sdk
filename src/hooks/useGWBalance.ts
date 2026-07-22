import { useState, useEffect, useCallback, useRef } from "react";
import { MarketplaceSDK } from "../core/MarketplaceSDK";

/**
 * Options for configuring the useGWBalance hook.
 */
export interface UseGWBalanceOptions {
  /**
   * Interval in milliseconds at which to automatically refetch the balance.
   * When not set (or set to 0), automatic refetching is disabled.
   */
  refetchInterval?: number;
  /**
   * Whether to refetch balance when the window regains focus.
   * Defaults to true.
   */
  refetchOnFocus?: boolean;
}

/**
 * Result returned by the useGWBalance hook.
 */
export interface UseGWBalanceResult {
  /** Current token balance, or null if not yet loaded */
  balance: number | null;
  /** Whether a fetch is currently in progress */
  isLoading: boolean;
  /** Whether the cached balance may be outdated */
  isStale: boolean;
  /** Any error encountered during fetch, or null */
  error: Error | null;
  /** Manually trigger a balance refresh */
  refetch: () => void;
  /** Timestamp of the last successful fetch, or null */
  lastUpdated: Date | null;
  /** Formatted balance string, e.g. "27 tokens" */
  formattedBalance: string;
}

function formatBalance(balance: number | null): string {
  if (balance === null) return "-- tokens";
  return `${balance} ${balance === 1 ? "token" : "tokens"}`;
}

/**
 * React hook for subscribing to the user's SMART token balance.
 *
 * Uses MarketplaceSDK.getInstance() to retrieve the SDK instance and
 * calls the balance API endpoint. Supports automatic polling and
 * focus-based refetching.
 *
 * @param options - Optional configuration for refetch behaviour.
 *
 * @example
 * ```tsx
 * function BalanceWidget() {
 *   const { formattedBalance, isLoading, refetch } = useGWBalance({ refetchOnFocus: true });
 *   return <span>{isLoading ? 'Loading...' : formattedBalance}</span>;
 * }
 * ```
 */
export function useGWBalance(
  options: UseGWBalanceOptions = {},
): UseGWBalanceResult {
  const { refetchInterval, refetchOnFocus = true } = options;

  const [balance, setBalance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Tracks whether we have data from a previous successful fetch.
  // Using a ref avoids stale-closure issues inside the async callback.
  const hasDataRef = useRef(false);

  // Stable ref for the fetch function so interval/event handlers
  // don't stale-close over the initial value.
  const fetchRef = useRef<() => void>(() => undefined);

  const fetchBalance = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const sdk = MarketplaceSDK.getInstance();
      const result = await sdk.getTokenBalance();
      setBalance(result.balance);
      setLastUpdated(new Date());
      setIsStale(false);
      hasDataRef.current = true;
    } catch (err) {
      const fetchError = err instanceof Error ? err : new Error(String(err));
      setError(fetchError);
      // Mark existing data as stale when a refetch fails so consumers
      // can choose to render a degraded state rather than hiding data.
      if (hasDataRef.current) {
        setIsStale(true);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Keep the ref current so the interval always calls the latest version.
  fetchRef.current = fetchBalance;

  // Initial fetch on mount.
  useEffect(() => {
    fetchRef.current();
  }, []);

  // Polling interval.
  useEffect(() => {
    if (!refetchInterval || refetchInterval <= 0) return;

    const id = setInterval(() => {
      fetchRef.current();
    }, refetchInterval);

    return () => clearInterval(id);
  }, [refetchInterval]);

  // Focus-based refetch.
  useEffect(() => {
    if (!refetchOnFocus) return;

    const handler = () => {
      setIsStale(true);
      fetchRef.current();
    };

    window.addEventListener("focus", handler);
    return () => window.removeEventListener("focus", handler);
  }, [refetchOnFocus]);

  const refetch = useCallback(() => {
    fetchRef.current();
  }, []);

  return {
    balance,
    isLoading,
    isStale,
    error,
    refetch,
    lastUpdated,
    formattedBalance: formatBalance(balance),
  };
}
