/**
 * Unit tests for PRIVY_REQUIRED purchase state (GW-4161)
 *
 * Tests:
 * - PURCHASE_STATE constants
 * - PrivyRequiredError type shape
 * - ApplicationItem.minimumPrivyLevel field
 * - usePurchaseButton privyRequired / privyError state
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import {
  PURCHASE_STATE,
  type PurchaseState,
  type PrivyRequiredError,
  type ApplicationItem,
} from '../../src/types/purchases';
import { usePurchaseButton } from '../../src/hooks/usePurchaseButton';
import { MarketplaceSDK } from '../../src/core/MarketplaceSDK';

// ---------------------------------------------------------------------------
// PURCHASE_STATE constants
// ---------------------------------------------------------------------------

describe('PURCHASE_STATE constants', () => {
  it('INSUFFICIENT_FUNDS is defined', () => {
    expect(PURCHASE_STATE.INSUFFICIENT_FUNDS).toBe('INSUFFICIENT_FUNDS');
  });

  it('PRIVY_REQUIRED is defined', () => {
    expect(PURCHASE_STATE.PRIVY_REQUIRED).toBe('PRIVY_REQUIRED');
  });

  it('has exactly two states', () => {
    expect(Object.keys(PURCHASE_STATE)).toHaveLength(2);
  });

  it('values are assignable to PurchaseState type', () => {
    const s1: PurchaseState = PURCHASE_STATE.INSUFFICIENT_FUNDS;
    const s2: PurchaseState = PURCHASE_STATE.PRIVY_REQUIRED;
    expect(s1).toBe('INSUFFICIENT_FUNDS');
    expect(s2).toBe('PRIVY_REQUIRED');
  });
});

// ---------------------------------------------------------------------------
// PrivyRequiredError type shape
// ---------------------------------------------------------------------------

describe('PrivyRequiredError type shape', () => {
  it('can be constructed with required fields', () => {
    const err: PrivyRequiredError = {
      code: 'insufficient_privy_level',
      message: 'Privy 1 required',
      currentLevel: 0,
      requiredLevel: 1,
    };
    expect(err.code).toBe('insufficient_privy_level');
    expect(err.currentLevel).toBe(0);
    expect(err.requiredLevel).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// ApplicationItem.minimumPrivyLevel
// ---------------------------------------------------------------------------

describe('ApplicationItem.minimumPrivyLevel', () => {
  it('defaults to optional (can be omitted)', () => {
    const item: ApplicationItem = {
      id: 'item-1',
      name: 'Test',
      description: 'desc',
      baseRateUsd: 1,
      wholesaleTokenCost: 10,
      userTokenCost: 14,
      status: 'active',
      visibility: 'visible',
      version: 1,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };
    expect(item.minimumPrivyLevel).toBeUndefined();
  });

  it('can be set to 0 (no privy required)', () => {
    const item: ApplicationItem = {
      id: 'item-1',
      name: 'Test',
      description: 'desc',
      baseRateUsd: 1,
      wholesaleTokenCost: 10,
      userTokenCost: 14,
      status: 'active',
      visibility: 'visible',
      version: 1,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      minimumPrivyLevel: 0,
    };
    expect(item.minimumPrivyLevel).toBe(0);
  });

  it('can be set to 1 (privy 1 required)', () => {
    const item: ApplicationItem = {
      id: 'item-1',
      name: 'Test',
      description: 'desc',
      baseRateUsd: 1,
      wholesaleTokenCost: 10,
      userTokenCost: 14,
      status: 'active',
      visibility: 'visible',
      version: 1,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      minimumPrivyLevel: 1,
    };
    expect(item.minimumPrivyLevel).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// usePurchaseButton — privyRequired / privyError
// ---------------------------------------------------------------------------

const ITEM_WITH_PRIVY: ApplicationItem = {
  id: 'item-privy-1',
  name: 'Privy-Gated Report',
  description: 'Requires Privy 1',
  baseRateUsd: 2.0,
  wholesaleTokenCost: 20,
  userTokenCost: 27,
  status: 'active',
  visibility: 'visible',
  version: 1,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  minimumPrivyLevel: 1,
};

const ITEM_NO_PRIVY: ApplicationItem = {
  id: 'item-no-privy',
  name: 'Free Report',
  description: 'No Privy required',
  baseRateUsd: 1.0,
  wholesaleTokenCost: 10,
  userTokenCost: 14,
  status: 'active',
  visibility: 'visible',
  version: 1,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  minimumPrivyLevel: 0,
};

function makeMockSDK(opts: {
  balance?: number;
  items?: ApplicationItem[];
  purchaseError?: Error & Partial<{ code: string; currentLevel: number; requiredLevel: number }>;
} = {}) {
  const { balance = 100, items = [ITEM_WITH_PRIVY, ITEM_NO_PRIVY] } = opts;
  return {
    getTokenBalance: vi.fn().mockResolvedValue({ balance, unit: 'SMART' }),
    getItems: vi.fn().mockResolvedValue(items),
    purchase: vi.fn().mockImplementation(async () => {
      if (opts.purchaseError) throw opts.purchaseError;
      return {
        purchaseId: 'p-1',
        itemId: 'item-privy-1',
        itemName: 'Privy-Gated Report',
        quantity: 1,
        totalTokenCost: 27,
        remainingBalance: 73,
        purchasedAt: '2026-03-24T00:00:00Z',
        status: 'completed' as const,
      };
    }),
  } as unknown as MarketplaceSDK;
}

describe('usePurchaseButton — Privy state', () => {
  let getInstanceSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    getInstanceSpy = vi.spyOn(MarketplaceSDK, 'getInstance');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('privyRequired is false initially', async () => {
    getInstanceSpy.mockReturnValue(makeMockSDK());
    const { result } = renderHook(() => usePurchaseButton('item-privy-1'));
    expect(result.current.privyRequired).toBe(false);
    await waitFor(() => expect(result.current.balance).toBe(100));
  });

  it('privyError is null initially', async () => {
    getInstanceSpy.mockReturnValue(makeMockSDK());
    const { result } = renderHook(() => usePurchaseButton('item-privy-1'));
    expect(result.current.privyError).toBeNull();
    await waitFor(() => expect(result.current.balance).toBe(100));
  });

  it('sets privyRequired=true when purchase fails with insufficient_privy_level', async () => {
    const privyErr = Object.assign(new Error('Privy 1 required'), {
      code: 'insufficient_privy_level',
      currentLevel: 0,
      requiredLevel: 1,
    });
    getInstanceSpy.mockReturnValue(makeMockSDK({ purchaseError: privyErr }));
    const { result } = renderHook(() => usePurchaseButton('item-privy-1'));

    await waitFor(() => expect(result.current.canPurchase).toBe(true));

    await act(async () => {
      await result.current.purchase().catch(() => undefined);
    });

    expect(result.current.privyRequired).toBe(true);
  });

  it('populates privyError with currentLevel and requiredLevel', async () => {
    const privyErr = Object.assign(new Error('Privy 1 required'), {
      code: 'insufficient_privy_level',
      currentLevel: 0,
      requiredLevel: 1,
    });
    getInstanceSpy.mockReturnValue(makeMockSDK({ purchaseError: privyErr }));
    const { result } = renderHook(() => usePurchaseButton('item-privy-1'));

    await waitFor(() => expect(result.current.canPurchase).toBe(true));

    await act(async () => {
      await result.current.purchase().catch(() => undefined);
    });

    expect(result.current.privyError).toMatchObject({
      code: 'insufficient_privy_level',
      currentLevel: 0,
      requiredLevel: 1,
    });
  });

  it('does not set privyRequired for insufficient_balance error', async () => {
    const balanceErr = Object.assign(new Error('Insufficient balance'), {
      code: 'insufficient_balance',
    });
    getInstanceSpy.mockReturnValue(makeMockSDK({ purchaseError: balanceErr, balance: 1 }));
    const { result } = renderHook(() => usePurchaseButton('item-privy-1'));

    // With balance=1 and item cost=27, canPurchase will be false.
    // Force a purchase attempt anyway.
    await waitFor(() => expect(result.current.item).toBeDefined());

    await act(async () => {
      await result.current.purchase().catch(() => undefined);
    });

    expect(result.current.privyRequired).toBe(false);
    expect(result.current.privyError).toBeNull();
  });

  it('exposes privyRequired and privyError in hook result shape', async () => {
    getInstanceSpy.mockReturnValue(makeMockSDK());
    const { result } = renderHook(() => usePurchaseButton('item-privy-1'));
    await waitFor(() => expect(result.current.balance).toBe(100));

    expect('privyRequired' in result.current).toBe(true);
    expect('privyError' in result.current).toBe(true);
  });
});
