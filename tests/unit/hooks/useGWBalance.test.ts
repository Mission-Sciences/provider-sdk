import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useGWBalance } from '../../../src/hooks/useGWBalance';
import { MarketplaceSDK } from '../../../src/core/MarketplaceSDK';
import { SDKError } from '../../../src/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockSDK(balance: number | Error = 100) {
  return {
    getTokenBalance: vi.fn().mockImplementation(async () => {
      if (balance instanceof Error) throw balance;
      return { balance, unit: 'SMART' };
    }),
  } as unknown as MarketplaceSDK;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useGWBalance', () => {
  let getInstanceSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    getInstanceSpy = vi.spyOn(MarketplaceSDK, 'getInstance');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('fetches balance on mount and returns formatted string', async () => {
    getInstanceSpy.mockReturnValue(makeMockSDK(42));

    const { result } = renderHook(() => useGWBalance());

    // Initially loading
    expect(result.current.isLoading).toBe(true);
    expect(result.current.balance).toBeNull();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.balance).toBe(42);
    expect(result.current.formattedBalance).toBe('42 tokens');
    expect(result.current.error).toBeNull();
    expect(result.current.lastUpdated).toBeInstanceOf(Date);
    expect(result.current.isStale).toBe(false);
  });

  it('formats singular token correctly', async () => {
    getInstanceSpy.mockReturnValue(makeMockSDK(1));
    const { result } = renderHook(() => useGWBalance());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.formattedBalance).toBe('1 token');
  });

  it('formats zero tokens correctly', async () => {
    getInstanceSpy.mockReturnValue(makeMockSDK(0));
    const { result } = renderHook(() => useGWBalance());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.formattedBalance).toBe('0 tokens');
  });

  it('returns placeholder when balance is null (not yet loaded)', () => {
    // Delay resolution so we can inspect the initial state.
    const sdk = { getTokenBalance: vi.fn().mockReturnValue(new Promise(() => undefined)) } as unknown as MarketplaceSDK;
    getInstanceSpy.mockReturnValue(sdk);

    const { result } = renderHook(() => useGWBalance());
    expect(result.current.formattedBalance).toBe('-- tokens');
  });

  it('captures errors and exposes them', async () => {
    const fetchError = new SDKError('Unauthorized', 'NOT_INITIALIZED', 401);
    getInstanceSpy.mockReturnValue(makeMockSDK(fetchError));

    const { result } = renderHook(() => useGWBalance());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe(fetchError);
    expect(result.current.balance).toBeNull();
  });

  it('marks previous data as stale when a refetch fails', async () => {
    const sdk = makeMockSDK(50);
    getInstanceSpy.mockReturnValue(sdk);

    const { result } = renderHook(() => useGWBalance());
    await waitFor(() => expect(result.current.balance).toBe(50));

    // Simulate a network error on the second call.
    (sdk.getTokenBalance as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('network'));

    act(() => {
      result.current.refetch();
    });
    await waitFor(() => expect(result.current.error).not.toBeNull());

    // Balance from first fetch is preserved but marked stale.
    expect(result.current.balance).toBe(50);
    expect(result.current.isStale).toBe(true);
  });

  it('refetch triggers a new fetch', async () => {
    const sdk = makeMockSDK(10);
    getInstanceSpy.mockReturnValue(sdk);

    const { result } = renderHook(() => useGWBalance());
    await waitFor(() => expect(result.current.balance).toBe(10));

    (sdk.getTokenBalance as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ balance: 20, unit: 'SMART' });

    act(() => {
      result.current.refetch();
    });
    await waitFor(() => expect(result.current.balance).toBe(20));
    expect(sdk.getTokenBalance).toHaveBeenCalledTimes(2);
  });

  it('polls at the given interval', async () => {
    vi.useFakeTimers();
    const sdk = makeMockSDK(5);
    getInstanceSpy.mockReturnValue(sdk);

    const { result } = renderHook(() => useGWBalance({ refetchInterval: 1000 }));

    // Allow initial fetch to complete.
    await act(async () => { await Promise.resolve(); });
    expect(sdk.getTokenBalance).toHaveBeenCalledTimes(1);

    await act(async () => { vi.advanceTimersByTime(1000); await Promise.resolve(); });
    expect(sdk.getTokenBalance).toHaveBeenCalledTimes(2);

    await act(async () => { vi.advanceTimersByTime(1000); await Promise.resolve(); });
    expect(sdk.getTokenBalance).toHaveBeenCalledTimes(3);

    expect(result.current.balance).toBe(5);
  });
});
