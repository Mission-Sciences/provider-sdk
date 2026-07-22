import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useGWItems } from '../../../src/hooks/useGWItems';
import { MarketplaceSDK } from '../../../src/core/MarketplaceSDK';
import type { ApplicationItem } from '../../../src/types/purchases';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ITEM_A: ApplicationItem = {
  id: 'item-1',
  name: 'Dataset Alpha',
  description: 'A test dataset',
  baseRateUsd: 1.0,
  wholesaleTokenCost: 10,
  userTokenCost: 14,
  status: 'active',
  visibility: 'visible',
  version: 1,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const ITEM_B: ApplicationItem = {
  id: 'item-2',
  name: 'Report Beta',
  description: 'A test report',
  baseRateUsd: 2.5,
  wholesaleTokenCost: 25,
  userTokenCost: 34,
  status: 'inactive',
  visibility: 'hidden',
  version: 1,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

function makeMockSDK(items: ApplicationItem[] | Error = [ITEM_A, ITEM_B]) {
  return {
    getItems: vi.fn().mockImplementation(async () => {
      if (items instanceof Error) throw items;
      return items;
    }),
  } as unknown as MarketplaceSDK;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useGWItems', () => {
  let getInstanceSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    getInstanceSpy = vi.spyOn(MarketplaceSDK, 'getInstance');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('fetches items on mount', async () => {
    getInstanceSpy.mockReturnValue(makeMockSDK());

    const { result } = renderHook(() => useGWItems());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.items).toEqual([]);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.items).toHaveLength(2);
    expect(result.current.items[0].id).toBe('item-1');
    expect(result.current.error).toBeNull();
  });

  it('captures fetch errors', async () => {
    const fetchError = new Error('Server unavailable');
    getInstanceSpy.mockReturnValue(makeMockSDK(fetchError));

    const { result } = renderHook(() => useGWItems());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe(fetchError);
    expect(result.current.items).toEqual([]);
  });

  it('refetch re-calls getItems', async () => {
    const sdk = makeMockSDK();
    getInstanceSpy.mockReturnValue(sdk);

    const { result } = renderHook(() => useGWItems());
    await waitFor(() => expect(result.current.items).toHaveLength(2));

    act(() => { result.current.refetch(); });
    await waitFor(() => expect(sdk.getItems).toHaveBeenCalledTimes(2));
  });

  it('polls at the given interval', async () => {
    vi.useFakeTimers();
    const sdk = makeMockSDK();
    getInstanceSpy.mockReturnValue(sdk);

    renderHook(() => useGWItems({ refetchInterval: 2000 }));

    await act(async () => { await Promise.resolve(); });
    expect(sdk.getItems).toHaveBeenCalledTimes(1);

    await act(async () => { vi.advanceTimersByTime(2000); await Promise.resolve(); });
    expect(sdk.getItems).toHaveBeenCalledTimes(2);
  });

  it('does not poll when refetchInterval is not set', async () => {
    vi.useFakeTimers();
    const sdk = makeMockSDK();
    getInstanceSpy.mockReturnValue(sdk);

    renderHook(() => useGWItems());
    await act(async () => { await Promise.resolve(); });

    await act(async () => { vi.advanceTimersByTime(10000); await Promise.resolve(); });
    // Only the initial fetch — no polling.
    expect(sdk.getItems).toHaveBeenCalledTimes(1);
  });

  it('getItem returns item by id', async () => {
    getInstanceSpy.mockReturnValue(makeMockSDK());
    const { result } = renderHook(() => useGWItems());

    await waitFor(() => expect(result.current.items).toHaveLength(2));

    expect(result.current.getItem('item-1')).toEqual(ITEM_A);
    expect(result.current.getItem('item-2')).toEqual(ITEM_B);
    expect(result.current.getItem('unknown')).toBeUndefined();
  });

  it('getItemsByType filters by status', async () => {
    getInstanceSpy.mockReturnValue(makeMockSDK());
    const { result } = renderHook(() => useGWItems());

    await waitFor(() => expect(result.current.items).toHaveLength(2));

    expect(result.current.getItemsByType('active')).toEqual([ITEM_A]);
    expect(result.current.getItemsByType('inactive')).toEqual([ITEM_B]);
    expect(result.current.getItemsByType('deleted')).toEqual([]);
  });
});
