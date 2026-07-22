import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useGWPurchase } from '../../../src/hooks/useGWPurchase';
import { MarketplaceSDK } from '../../../src/core/MarketplaceSDK';
import type { PurchaseResult, ValidationResult, PurchaseError } from '../../../src/types/purchases';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_PURCHASE_RESULT: PurchaseResult = {
  purchaseId: 'txn-123',
  itemId: 'item-1',
  itemName: 'Dataset Alpha',
  quantity: 1,
  totalTokenCost: 10,
  remainingBalance: 90,
  purchasedAt: '2026-03-20T00:00:00Z',
  status: 'completed',
};

const MOCK_VALIDATION_RESULT: ValidationResult = {
  canPurchase: true,
  currentBalance: 100,
  itemCost: 10,
};

function makeMockSDK(
  purchaseResult: PurchaseResult | Error = MOCK_PURCHASE_RESULT,
  validationResult: ValidationResult | Error = MOCK_VALIDATION_RESULT
) {
  return {
    purchase: vi.fn().mockImplementation(async () => {
      if (purchaseResult instanceof Error) throw purchaseResult;
      return purchaseResult;
    }),
    validatePurchase: vi.fn().mockImplementation(async () => {
      if (validationResult instanceof Error) throw validationResult;
      return validationResult;
    }),
  } as unknown as MarketplaceSDK;
}

function makePurchaseError(code: PurchaseError['code'], message: string): PurchaseError {
  return { code, message };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useGWPurchase', () => {
  let getInstanceSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    getInstanceSpy = vi.spyOn(MarketplaceSDK, 'getInstance');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts with idle state', () => {
    getInstanceSpy.mockReturnValue(makeMockSDK());
    const { result } = renderHook(() => useGWPurchase());

    expect(result.current.isPurchasing).toBe(false);
    expect(result.current.lastPurchase).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('executes a purchase successfully', async () => {
    getInstanceSpy.mockReturnValue(makeMockSDK());
    const { result } = renderHook(() => useGWPurchase());

    let purchaseResult: PurchaseResult | undefined;
    await act(async () => {
      purchaseResult = await result.current.purchase({
        itemId: 'item-1',
        idempotencyKey: 'key-1',
        expectedUnitPrice: 10,
      });
    });

    expect(purchaseResult).toEqual(MOCK_PURCHASE_RESULT);
    expect(result.current.lastPurchase).toEqual(MOCK_PURCHASE_RESULT);
    expect(result.current.error).toBeNull();
    expect(result.current.isPurchasing).toBe(false);
  });

  it('sets isPurchasing to true while purchase is in flight', async () => {
    let resolve!: (v: PurchaseResult) => void;
    const pending = new Promise<PurchaseResult>((res) => { resolve = res; });
    const sdk = {
      purchase: vi.fn().mockReturnValue(pending),
      validatePurchase: vi.fn(),
    } as unknown as MarketplaceSDK;
    getInstanceSpy.mockReturnValue(sdk);

    const { result } = renderHook(() => useGWPurchase());

    act(() => {
      // Don't await — we want to inspect mid-flight state.
      void result.current.purchase({ itemId: 'item-1', idempotencyKey: 'k', expectedUnitPrice: 10 });
    });

    await waitFor(() => expect(result.current.isPurchasing).toBe(true));

    await act(async () => { resolve(MOCK_PURCHASE_RESULT); });
    expect(result.current.isPurchasing).toBe(false);
  });

  it('captures PurchaseError on failure', async () => {
    const purchaseError: PurchaseError = makePurchaseError('insufficient_balance', 'Insufficient balance');
    getInstanceSpy.mockReturnValue(makeMockSDK(new Error(JSON.stringify(purchaseError))));

    const { result } = renderHook(() => useGWPurchase());

    await act(async () => {
      await result.current.purchase({ itemId: 'item-1', idempotencyKey: 'k', expectedUnitPrice: 10 }).catch(() => undefined);
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.lastPurchase).toBeNull();
  });

  it('wraps non-PurchaseError in error object with validation_failed code', async () => {
    getInstanceSpy.mockReturnValue(makeMockSDK(new Error('Network failure')));

    const { result } = renderHook(() => useGWPurchase());
    await act(async () => {
      await result.current.purchase({ itemId: 'item-1', idempotencyKey: 'k', expectedUnitPrice: 10 }).catch(() => undefined);
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.error?.message).toBe('Network failure');
  });

  it('clearError resets the error state', async () => {
    getInstanceSpy.mockReturnValue(makeMockSDK(new Error('oops')));

    const { result } = renderHook(() => useGWPurchase());
    await act(async () => {
      await result.current.purchase({ itemId: 'item-1', idempotencyKey: 'k', expectedUnitPrice: 10 }).catch(() => undefined);
    });

    expect(result.current.error).not.toBeNull();

    act(() => { result.current.clearError(); });
    expect(result.current.error).toBeNull();
  });

  it('validates a purchase without committing', async () => {
    getInstanceSpy.mockReturnValue(makeMockSDK());
    const { result } = renderHook(() => useGWPurchase());

    let validationResult: ValidationResult | undefined;
    await act(async () => {
      validationResult = await result.current.validate('item-1', 2);
    });

    expect(validationResult).toEqual(MOCK_VALIDATION_RESULT);
    // validate should not set lastPurchase
    expect(result.current.lastPurchase).toBeNull();
  });

  it('validate sets error state on failure', async () => {
    const validationError = { code: 'item_not_found', message: 'Item not found' } as PurchaseError;
    getInstanceSpy.mockReturnValue(makeMockSDK(MOCK_PURCHASE_RESULT, new Error(JSON.stringify(validationError))));

    const { result } = renderHook(() => useGWPurchase());
    await act(async () => {
      await result.current.validate('item-99').catch(() => undefined);
    });

    expect(result.current.error).toBeTruthy();
  });
});
