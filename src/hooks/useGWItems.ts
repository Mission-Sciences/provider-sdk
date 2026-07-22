import { useState, useEffect, useCallback, useRef } from "react";
import { MarketplaceSDK } from "../core/MarketplaceSDK";
import type { ApplicationItem } from "../types/purchases";

/**
 * Options for configuring the useGWItems hook.
 */
export interface UseGWItemsOptions {
  /**
   * Interval in milliseconds at which to automatically refetch the item list.
   * When not set (or set to 0), automatic refetching is disabled.
   */
  refetchInterval?: number;
}

/**
 * Result returned by the useGWItems hook.
 */
export interface UseGWItemsResult {
  /** List of available marketplace items */
  items: ApplicationItem[];
  /** Whether a fetch is currently in progress */
  isLoading: boolean;
  /** Any error encountered during fetch, or null */
  error: Error | null;
  /** Manually trigger a refetch of the item list */
  refetch: () => void;
  /** Look up a single item by its ID from the current item list */
  getItem: (id: string) => ApplicationItem | undefined;
  /**
   * Filter items by status.
   * Passing "active" returns only purchasable items; "inactive" returns
   * unavailable items. Defaults to filtering by the provided value.
   */
  getItemsByType: (status: ApplicationItem["status"]) => ApplicationItem[];
}

/**
 * React hook for fetching the list of purchasable session items.
 *
 * Uses MarketplaceSDK.getInstance() to retrieve the SDK instance and
 * calls the session items endpoint. Supports automatic polling.
 *
 * @param options - Optional configuration for refetch behaviour.
 *
 * @example
 * ```tsx
 * function ItemList() {
 *   const { items, isLoading, error } = useGWItems();
 *   if (isLoading) return <p>Loading items\u2026</p>;
 *   if (error) return <p>Error: {error.message}</p>;
 *   return <ul>{items.map(item => <li key={item.id}>{item.name}</li>)}</ul>;
 * }
 * ```
 */
export function useGWItems(options: UseGWItemsOptions = {}): UseGWItemsResult {
  const { refetchInterval } = options;

  const [items, setItems] = useState<ApplicationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchRef = useRef<() => void>(() => undefined);

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const sdk = MarketplaceSDK.getInstance();
      const result = await sdk.getItems();
      setItems(result);
    } catch (err) {
      const fetchError = err instanceof Error ? err : new Error(String(err));
      setError(fetchError);
    } finally {
      setIsLoading(false);
    }
  }, []);

  fetchRef.current = fetchItems;

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

  const refetch = useCallback(() => {
    fetchRef.current();
  }, []);

  const getItem = useCallback(
    (id: string): ApplicationItem | undefined =>
      items.find((item) => item.id === id),
    [items],
  );

  const getItemsByType = useCallback(
    (status: ApplicationItem["status"]): ApplicationItem[] =>
      items.filter((item) => item.status === status),
    [items],
  );

  return { items, isLoading, error, refetch, getItem, getItemsByType };
}
