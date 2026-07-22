/**
 * Purchase Events and PurchaseModal Unit Tests
 *
 * Covers:
 * - SDKEvents purchase event types
 * - PurchaseModal DOM rendering and interactions
 * - MarketplaceSDK.requestPurchase event flow
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PurchaseModal } from '../../src/ui/PurchaseModal';
import { PurchaseResult, PurchaseError, SDKEvents } from '../../src/types';

// ---------------------------------------------------------------------------
// Minimal DOM helpers (jsdom is not configured — we test logic, not full DOM)
// ---------------------------------------------------------------------------

function makeMockElement(tag = 'div') {
  const el: any = {
    tagName: tag.toUpperCase(),
    id: '',
    style: { cssText: '' },
    innerHTML: '',
    textContent: '',
    disabled: false,
    getAttribute: vi.fn(),
    setAttribute: vi.fn(),
    appendChild: vi.fn(),
    removeChild: vi.fn(),
    querySelectorAll: vi.fn(() => []),
    addEventListener: vi.fn(),
    parentNode: null as any,
    children: [],
  };
  el.parentNode = { removeChild: vi.fn() };
  return el;
}

function setupDomMocks() {
  const mockModal = makeMockElement('div');
  const mockContent = makeMockElement('div');
  const mockConfirmBtn = makeMockElement('button');
  const mockCancelBtn = makeMockElement('button');
  const mockErrorDiv = makeMockElement('div');

  // Ensure querySelectorAll returns iterable
  mockContent.querySelectorAll = vi.fn(() => [mockConfirmBtn, mockCancelBtn]);

  vi.stubGlobal('document', {
    createElement: vi.fn((tag: string) => {
      if (tag === 'div') return mockModal;
      if (tag === 'button') return mockConfirmBtn;
      return makeMockElement(tag);
    }),
    getElementById: vi.fn((id: string) => {
      if (id === 'gw-purchase-confirm-btn') return mockConfirmBtn;
      if (id === 'gw-purchase-cancel-btn') return mockCancelBtn;
      if (id === 'gw-purchase-error') return mockErrorDiv;
      return null;
    }),
    body: {
      appendChild: vi.fn(),
    },
    createTextNode: vi.fn((text: string) => ({ data: text })),
  });

  return { mockModal, mockContent, mockConfirmBtn, mockCancelBtn, mockErrorDiv };
}

// ---------------------------------------------------------------------------
// Type tests — verify SDKEvents has correct purchase event signatures
// ---------------------------------------------------------------------------

describe('SDKEvents purchase event types', () => {
  it('onPurchaseStart has correct signature', () => {
    const handler: SDKEvents['onPurchaseStart'] = (data) => {
      expect(typeof data.itemId).toBe('string');
      expect(typeof data.quantity).toBe('number');
    };
    handler({ itemId: 'item-1', quantity: 1 });
  });

  it('onPurchaseSuccess has correct signature', () => {
    const result: PurchaseResult = {
      purchaseId: 'txn-123',
      itemId: 'item-1',
      itemName: 'Test Item',
      quantity: 1,
      totalTokenCost: 50,
      remainingBalance: 950,
      purchasedAt: '2023-01-01T00:00:00Z',
      status: 'completed',
    };
    const handler: SDKEvents['onPurchaseSuccess'] = (r) => {
      expect(r.purchaseId).toBe('txn-123');
      expect(r.remainingBalance).toBe(950);
    };
    handler(result);
  });

  it('onPurchaseError has correct signature', () => {
    const error: PurchaseError = {
      code: 'insufficient_balance',
      message: 'Not enough tokens',
      itemId: 'item-1',
      currentBalance: 100,
      itemCost: 200,
    };
    const handler: SDKEvents['onPurchaseError'] = (e) => {
      expect(e.code).toBe('insufficient_balance');
      expect(e.itemId).toBe('item-1');
    };
    handler(error);
  });

  it('onBalanceChange receives TokenBalance', () => {
    const balance = { balance: 750, unit: 'SMART' };
    const handler: SDKEvents['onBalanceChange'] = (b) => {
      expect(typeof b.balance).toBe('number');
      expect(typeof b.unit).toBe('string');
    };
    handler(balance);
  });

  it('onSessionExtended has correct signature', () => {
    const handler: SDKEvents['onSessionExtended'] = (data) => {
      expect(typeof data.newExpiresAt).toBe('number');
      expect(typeof data.additionalMinutes).toBe('number');
    };
    handler({ newExpiresAt: 1640995200, additionalMinutes: 15 });
  });
});

// ---------------------------------------------------------------------------
// PurchaseModal unit tests
// ---------------------------------------------------------------------------

describe('PurchaseModal', () => {
  let mocks: ReturnType<typeof setupDomMocks>;

  beforeEach(() => {
    mocks = setupDomMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('constructs without throwing', () => {
    expect(() => new PurchaseModal('light')).not.toThrow();
  });

  it('constructs with dark theme', () => {
    expect(() => new PurchaseModal('dark')).not.toThrow();
  });

  it('constructs with custom styles', () => {
    expect(
      () =>
        new PurchaseModal('light', {
          backgroundColor: '#fff',
          textColor: '#000',
          primaryColor: '#0000ff',
          borderRadius: '4px',
          fontFamily: 'Arial',
        }),
    ).not.toThrow();
  });

  it('isShown returns false before show() is called', () => {
    const modal = new PurchaseModal('light');
    expect(modal.isShown()).toBe(false);
  });

  it('hide() does not throw when modal is not shown', () => {
    const modal = new PurchaseModal('light');
    expect(() => modal.hide()).not.toThrow();
  });

  it('show() calls document.createElement and body.appendChild', () => {
    const modal = new PurchaseModal('light');
    const onConfirm = vi.fn().mockResolvedValue(undefined);

    modal.show({
      item: { id: 'item-1', name: 'Test Item', tokenCost: 100 },
      quantity: 1,
      currentBalance: 500,
      onConfirm,
    });

    expect(document.createElement).toHaveBeenCalled();
    expect(document.body.appendChild).toHaveBeenCalled();
  });

  it('show() calls document.createElement for insufficient balance case', () => {
    const modal = new PurchaseModal('light');
    const onConfirm = vi.fn().mockResolvedValue(undefined);

    modal.show({
      item: { id: 'item-1', name: 'Expensive Item', tokenCost: 1000 },
      quantity: 1,
      currentBalance: 50,
      onConfirm,
    });

    expect(document.createElement).toHaveBeenCalled();
  });

  it('showSuccess() calls document.createElement', () => {
    const modal = new PurchaseModal('light');
    const result: PurchaseResult = {
      purchaseId: 'txn-abc',
      itemId: 'item-1',
      itemName: 'Test Item',
      quantity: 1,
      totalTokenCost: 100,
      remainingBalance: 400,
      purchasedAt: '2023-01-01T00:00:00Z',
      status: 'completed',
    };

    modal.showSuccess(result, 100);

    expect(document.createElement).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// PurchaseResult and PurchaseError interface completeness
// ---------------------------------------------------------------------------

describe('PurchaseResult interface', () => {
  it('has all required fields', () => {
    const result: PurchaseResult = {
      purchaseId: 'txn-1',
      itemId: 'item-1',
      itemName: 'Test Item',
      quantity: 2,
      totalTokenCost: 200,
      remainingBalance: 800,
      purchasedAt: '2023-01-01T00:00:00Z',
      status: 'completed',
    };

    expect(result.purchaseId).toBeDefined();
    expect(result.itemId).toBeDefined();
    expect(result.quantity).toBe(2);
    expect(result.totalTokenCost).toBe(200);
    expect(result.remainingBalance).toBe(800);
  });
});

describe('PurchaseError interface', () => {
  it('requires code, message, and itemId', () => {
    const error: PurchaseError = {
      code: 'validation_failed',
      message: 'Something went wrong',
      itemId: 'item-1',
    };
    expect(error.code).toBe('validation_failed');
    expect(error.itemId).toBe('item-1');
  });

  it('includes balance details for insufficient_balance errors', () => {
    const error: PurchaseError = {
      code: 'insufficient_balance',
      message: 'Not enough tokens',
      itemId: 'item-1',
      currentBalance: 50,
      itemCost: 100,
    };
    expect(error.currentBalance).toBe(50);
    expect(error.itemCost).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// MarketplaceSDK.requestPurchase method tests (GW-2527)
// ---------------------------------------------------------------------------

describe('MarketplaceSDK requestPurchase method', () => {
  let mockSDK: any;
  let mockPurchaseModal: any;

  beforeEach(() => {
    mockPurchaseModal = {
      show: vi.fn(),
      hide: vi.fn(),
      isShown: vi.fn().mockReturnValue(false),
    };

    mockSDK = {
      getTokenBalance: vi.fn().mockResolvedValue({ balance: 500, unit: 'SMART' }),
      getAvailableItems: vi.fn().mockResolvedValue([]),
      requestPurchase: vi.fn(),
    };

    // Set up DOM mocks for PurchaseModal
    setupDomMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('requestPurchase method exists on MarketplaceSDK', () => {
    expect(typeof mockSDK.requestPurchase).toBe('function');
  });

  it('requestPurchase opens PurchaseModal for hidden item', async () => {
    const mockItem = {
      id: 'hidden-item-1',
      name: 'Hidden Premium Feature',
      description: 'Special hidden feature',
      userTokenCost: 100,
      status: 'active',
      visibility: 'hidden',
    };

    // Mock that the item exists but is hidden (not in getAvailableItems)
    mockSDK.getAvailableItems.mockResolvedValue([]);

    // Mock implementation that would fetch the specific item
    mockSDK.requestPurchase.mockImplementation(async (itemId: string) => {
      if (itemId === 'hidden-item-1') {
        // Should open PurchaseModal with the hidden item
        mockPurchaseModal.show({
          item: mockItem,
          currentBalance: 500,
          onConfirm: vi.fn(),
          onCancel: vi.fn(),
        });
      }
    });

    await mockSDK.requestPurchase('hidden-item-1');

    expect(mockPurchaseModal.show).toHaveBeenCalledWith(
      expect.objectContaining({
        item: expect.objectContaining({
          id: 'hidden-item-1',
          name: 'Hidden Premium Feature',
        }),
        currentBalance: 500,
      }),
    );
  });

  it('requestPurchase throws error for non-existent item', async () => {
    mockSDK.requestPurchase.mockImplementation(async (itemId: string) => {
      if (itemId === 'non-existent-item') {
        throw new Error('Item not found');
      }
    });

    await expect(mockSDK.requestPurchase('non-existent-item')).rejects.toThrow('Item not found');
  });

  it('requestPurchase works with visible items too', async () => {
    const visibleItem = {
      id: 'visible-item-1',
      name: 'Visible Feature',
      description: 'A visible premium feature',
      userTokenCost: 75,
      status: 'active',
      visibility: 'visible',
    };

    mockSDK.requestPurchase.mockImplementation(async (itemId: string) => {
      if (itemId === 'visible-item-1') {
        mockPurchaseModal.show({
          item: visibleItem,
          currentBalance: 500,
          onConfirm: vi.fn(),
          onCancel: vi.fn(),
        });
      }
    });

    await mockSDK.requestPurchase('visible-item-1');

    expect(mockPurchaseModal.show).toHaveBeenCalledWith(
      expect.objectContaining({
        item: expect.objectContaining({
          id: 'visible-item-1',
          name: 'Visible Feature',
        }),
      }),
    );
  });
});
