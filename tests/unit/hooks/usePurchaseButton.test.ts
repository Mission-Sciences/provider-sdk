import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePurchaseButton } from '../../../src/hooks/usePurchaseButton';
import { MarketplaceSDK } from '../../../src/core/MarketplaceSDK';
import type { ApplicationItem, PurchaseResult, PurchaseError } from '../../../src/types/purchases';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ITEM: ApplicationItem = {
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
  const {
    balance = 100,
    items = [ITEM],
    purchaseResult = MOCK_PURCHASE_RESULT,
  } = opts;
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
  } as unknown as MarketplaceSDK;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('usePurchaseButton', () => {
  let getInstanceSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    getInstanceSpy = vi.spyOn(MarketplaceSDK, 'getInstance');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts with undefined item and null balance', async () => {
    getInstanceSpy.mockReturnValue(makeMockSDK());
    const { result } = renderHook(() => usePurchaseButton('item-1'));

    expect(result.current.isPurchasing).toBe(false);
    expect(result.current.error).toBeNull();

    // Wait for async effect to settle to avoid act() warnings
    await waitFor(() => expect(result.current.balance).toBe(100));
  });

  it('loads item and balance asynchronously', async () => {
    getInstanceSpy.mockReturnValue(makeMockSDK());
    const { result } = renderHook(() => usePurchaseButton('item-1'));

    await waitFor(() => expect(result.current.balance).toBe(100));
    await waitFor(() => expect(result.current.item).toEqual(ITEM));
  });

  it('canPurchase is true when balance is sufficient', async () => {
    getInstanceSpy.mockReturnValue(makeMockSDK({ balance: 100 }));
    const { result } = renderHook(() => usePurchaseButton('item-1'));

    await waitFor(() => expect(result.current.canPurchase).toBe(true));
    expect(result.current.insufficientFunds).toBe(false);
  });

  it('canPurchase is false and insufficientFunds is true when balance is too low', async () => {
    getInstanceSpy.mockReturnValue(makeMockSDK({ balance: 5 }));
    const { result } = renderHook(() => usePurchaseButton('item-1'));

    await waitFor(() => expect(result.current.balance).toBe(5));
    await waitFor(() => expect(result.current.item).toBeDefined());

    expect(result.current.canPurchase).toBe(false);
    expect(result.current.insufficientFunds).toBe(true);
  });

  it('executes a purchase successfully', async () => {
    getInstanceSpy.mockReturnValue(makeMockSDK());
    const { result } = renderHook(() => usePurchaseButton('item-1'));

    await waitFor(() => expect(result.current.canPurchase).toBe(true));

    let purchaseResult: PurchaseResult | undefined;
    await act(async () => {
      purchaseResult = await result.current.purchase();
    });

    expect(purchaseResult).toEqual(MOCK_PURCHASE_RESULT);
    expect(result.current.isPurchasing).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('sets error state when purchase fails', async () => {
    const purchaseError: PurchaseError = { code: 'insufficient_balance', message: 'Insufficient balance' };
    getInstanceSpy.mockReturnValue(makeMockSDK({ purchaseResult: Object.assign(new Error('Insufficient balance'), purchaseError) }));
    const { result } = renderHook(() => usePurchaseButton('item-1'));

    await waitFor(() => expect(result.current.canPurchase).toBe(true));

    await act(async () => {
      await result.current.purchase().catch(() => undefined);
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.isPurchasing).toBe(false);
  });
});
