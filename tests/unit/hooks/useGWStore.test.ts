import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useGWStore } from '../../../src/hooks/useGWStore';
import { MarketplaceSDK } from '../../../src/core/MarketplaceSDK';
import type { ApplicationItem, PurchaseResult } from '../../../src/types/purchases';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ITEM_A: ApplicationItem = {
  id: 'item-1',
  name: 'Dataset Alpha',
  description: 'A test dataset',
  baseRateUsd: 1.0,
  wholesaleTokenCost: 10,
  userTokenCost: 10,
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
  baseRateUsd: 5.0,
  wholesaleTokenCost: 50,
  userTokenCost: 50,
  status: 'active',
  visibility: 'visible',
  version: 1,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const MOCK_PURCHASE_RESULT: PurchaseResult = {
  purchaseId: 'txn-1',
  itemId: 'item-1',
  itemName: 'Dataset Alpha',
  quantity: 1,
  totalTokenCost: 10,
  remainingBalance: 90,
  purchasedAt: '2026-03-20T00:00:00Z',
  status: 'completed',
};

function makeMockSDK(opts: {
  balance?: number | Error;
  items?: ApplicationItem[] | Error;
  purchaseResult?: PurchaseResult | Error;
} = {}) {
  const { balance = 100, items = [ITEM_A, ITEM_B], purchaseResult = MOCK_PURCHASE_RESULT } = opts;
  return {
    getTokenBalance: vi.fn().mockImplementation(async () => {
      if (balance instanceof Error) throw balance;
      return { balance, unit: 'SMART' };
    }),
    getItems: vi.fn().mockImplementation(async () => {
      if (items instanceof Error) throw items;
      return items;
    }),
    purchase: vi.fn().mockImplementation(async () => {
      if (purchaseResult instanceof Error) throw purchaseResult;
      return purchaseResult;
    }),
    validatePurchase: vi.fn().mockResolvedValue({ canPurchase: true, currentBalance: 100, itemCost: 10 }),
  } as unknown as MarketplaceSDK;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useGWStore', () => {
  let getInstanceSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    getInstanceSpy = vi.spyOn(MarketplaceSDK, 'getInstance');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads balance and items on mount', async () => {
    getInstanceSpy.mockReturnValue(makeMockSDK());

    const { result } = renderHook(() => useGWStore());

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.balance).toBe(100);
    expect(result.current.items).toHaveLength(2);
    expect(result.current.error).toBeNull();
  });

  it('formats balance as a string', async () => {
    getInstanceSpy.mockReturnValue(makeMockSDK({ balance: 1 }));

    const { result } = renderHook(() => useGWStore());
    await waitFor(() => expect(result.current.balance).toBe(1));

    expect(result.current.formattedBalance).toBe('1 token');
  });

  it('canPurchase returns true when balance is sufficient', async () => {
    getInstanceSpy.mockReturnValue(makeMockSDK({ balance: 100 }));

    const { result } = renderHook(() => useGWStore());
    await waitFor(() => expect(result.current.balance).toBe(100));
    await waitFor(() => expect(result.current.items).toHaveLength(2));

    expect(result.current.canPurchase('item-1')).toBe(true);  // costs 10
    expect(result.current.canPurchase('item-2')).toBe(true);  // costs 50
  });

  it('canPurchase returns false when balance is insufficient', async () => {
    getInstanceSpy.mockReturnValue(makeMockSDK({ balance: 5 }));

    const { result } = renderHook(() => useGWStore());
    await waitFor(() => expect(result.current.balance).toBe(5));
    await waitFor(() => expect(result.current.items).toHaveLength(2));

    expect(result.current.canPurchase('item-1')).toBe(false);  // costs 10, have 5
  });

  it('canPurchase returns false for unknown item', async () => {
    getInstanceSpy.mockReturnValue(makeMockSDK());

    const { result } = renderHook(() => useGWStore());
    await waitFor(() => expect(result.current.items).toHaveLength(2));

    expect(result.current.canPurchase('unknown-item')).toBe(false);
  });

  it('canPurchase accounts for quantity', async () => {
    getInstanceSpy.mockReturnValue(makeMockSDK({ balance: 15 }));

    const { result } = renderHook(() => useGWStore());
    await waitFor(() => expect(result.current.balance).toBe(15));
    await waitFor(() => expect(result.current.items).toHaveLength(2));

    expect(result.current.canPurchase('item-1', 1)).toBe(true);   // 10 tokens needed
    expect(result.current.canPurchase('item-1', 2)).toBe(false);  // 20 tokens needed
  });

  it('purchase executes successfully', async () => {
    getInstanceSpy.mockReturnValue(makeMockSDK());

    const { result } = renderHook(() => useGWStore());
    await waitFor(() => expect(result.current.balance).toBe(100));
    await waitFor(() => expect(result.current.items).toHaveLength(2));

    let purchaseResult: PurchaseResult | undefined;
    await act(async () => {
      purchaseResult = await result.current.purchase({
        itemId: 'item-1',
        idempotencyKey: 'key-1',
        expectedUnitPrice: 10,
      });
    });

    expect(purchaseResult).toEqual(MOCK_PURCHASE_RESULT);
    expect(result.current.isPurchasing).toBe(false);
  });

  it('purchase throws when canPurchase is false', async () => {
    getInstanceSpy.mockReturnValue(makeMockSDK({ balance: 5 }));

    const { result } = renderHook(() => useGWStore());
    await waitFor(() => expect(result.current.balance).toBe(5));
    await waitFor(() => expect(result.current.items).toHaveLength(2));

    await expect(
      act(async () => {
        await result.current.purchase({ itemId: 'item-1', idempotencyKey: 'k', expectedUnitPrice: 10 });
      })
    ).rejects.toMatchObject({ code: 'insufficient_balance' });
  });

  it('surfaces balance fetch error', async () => {
    const fetchError = new Error('Balance unavailable');
    getInstanceSpy.mockReturnValue(makeMockSDK({ balance: fetchError }));

    const { result } = renderHook(() => useGWStore());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe(fetchError);
  });
});
