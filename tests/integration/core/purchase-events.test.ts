/**
 * Integration tests for purchase events and requestPurchase method (GW-2506)
 *
 * Tests all 6 purchase lifecycle events and the requestPurchase method:
 * - onPurchaseStart, onPurchaseSuccess, onPurchaseError
 * - onPurchaseComplete, onPurchaseCancelled, onBalanceUpdate
 * - requestPurchase method functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MarketplaceSDK } from '../../../src/core/MarketplaceSDK';
import { PurchaseModal } from '../../../src/ui/PurchaseModal';
import type {
  PurchaseRequest,
  PurchaseResult,
  PurchaseError,
  SDKEvents
} from '../../../src/types';

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------

function makeSDK(): MarketplaceSDK {
  return new MarketplaceSDK({
    apiEndpoint: 'https://api.test.example.com',
    jwksUri: 'https://api.test.example.com/.well-known/jwks.json',
    debug: false,
    autoStart: false,
  });
}

function injectSession(sdk: MarketplaceSDK): void {
  const future = Math.floor(Date.now() / 1000) + 3600;
  (sdk as any).sessionData = {
    sessionId: 'session-events-001',
    applicationId: 'app-001',
    userId: 'user-001',
    orgId: 'org-001',
    startTime: Math.floor(Date.now() / 1000),
    durationMinutes: 60,
    iat: Math.floor(Date.now() / 1000),
    exp: future,
    iss: 'generalwisdom.com',
    sub: 'user-001',
  };
  (sdk as any).jwtToken = 'test-jwt-token';
}

const MOCK_PURCHASE_RESULT: PurchaseResult = {
  purchaseId: 'purchase-001',
  itemId: 'item-001',
  itemName: 'Test Item',
  quantity: 1,
  totalTokenCost: 27,
  remainingBalance: 100,
  purchasedAt: '2026-03-24T15:00:00Z',
  status: 'completed',
};

const MOCK_PURCHASE_ERROR: PurchaseError = {
  code: 'insufficient_balance',
  message: 'Insufficient token balance',
  itemId: 'item-001',
  currentBalance: 10,
  itemCost: 27,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Purchase Events', () => {
  let sdk: MarketplaceSDK;
  let mockFetch: any;
  let eventCallbacks: Partial<SDKEvents>;

  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = '';

    // Create fresh SDK
    sdk = makeSDK();
    injectSession(sdk);

    // Mock fetch
    mockFetch = vi.fn();
    global.fetch = mockFetch;

    // Reset event callbacks
    eventCallbacks = {};
  });

  afterEach(() => {
    // Clean up any modals
    const modals = document.querySelectorAll('[id^="gw-purchase"]');
    modals.forEach(modal => modal.remove());

    // Clean up SDK instance
    if ((sdk as any).purchaseModal) {
      (sdk as any).purchaseModal.hide();
      (sdk as any).purchaseModal = null;
    }

    vi.restoreAllMocks();
  });

  describe('Event Registration', () => {
    it('should register all 6 purchase events via sdk.on()', () => {
      const events = {
        onPurchaseStart: vi.fn(),
        onPurchaseSuccess: vi.fn(),
        onPurchaseError: vi.fn(),
        onPurchaseComplete: vi.fn(),
        onPurchaseCancelled: vi.fn(),
        onBalanceUpdate: vi.fn(),
      };

      // Register all events
      sdk.on('onPurchaseStart', events.onPurchaseStart);
      sdk.on('onPurchaseSuccess', events.onPurchaseSuccess);
      sdk.on('onPurchaseError', events.onPurchaseError);
      sdk.on('onPurchaseComplete', events.onPurchaseComplete);
      sdk.on('onPurchaseCancelled', events.onPurchaseCancelled);
      sdk.on('onBalanceUpdate', events.onBalanceUpdate);

      // Verify events are registered
      expect((sdk as any).events.onPurchaseStart).toBe(events.onPurchaseStart);
      expect((sdk as any).events.onPurchaseSuccess).toBe(events.onPurchaseSuccess);
      expect((sdk as any).events.onPurchaseError).toBe(events.onPurchaseError);
      expect((sdk as any).events.onPurchaseComplete).toBe(events.onPurchaseComplete);
      expect((sdk as any).events.onPurchaseCancelled).toBe(events.onPurchaseCancelled);
      expect((sdk as any).events.onBalanceUpdate).toBe(events.onBalanceUpdate);
    });
  });

  describe('requestPurchase Method', () => {
    it('should throw error if no active session exists', () => {
      const sdkNoSession = makeSDK();

      expect(() => {
        sdkNoSession.requestPurchase('item-001');
      }).toThrow('No active session. Cannot request purchase.');
    });

    it('should fire onPurchaseStart event when requestPurchase is called', () => {
      const onPurchaseStart = vi.fn();
      sdk.on('onPurchaseStart', onPurchaseStart);

      sdk.requestPurchase('item-001');

      expect(onPurchaseStart).toHaveBeenCalledWith({
        itemId: 'item-001',
        quantity: 1,
      });
    });

    it('should create and show PurchaseModal when requestPurchase is called', () => {
      sdk.requestPurchase('item-001');

      // Verify modal was created and shown
      expect((sdk as any).purchaseModal).toBeInstanceOf(PurchaseModal);
      const modal = document.getElementById('gw-purchase-modal');
      expect(modal).toBeTruthy();
      expect(modal?.style.display).not.toBe('none');
    });

    it('should fire onPurchaseCancelled when user cancels modal', () => {
      const onPurchaseCancelled = vi.fn();
      sdk.on('onPurchaseCancelled', onPurchaseCancelled);

      sdk.requestPurchase('item-001');

      // Simulate cancel button click
      const cancelBtn = document.getElementById('gw-purchase-cancel-btn') as HTMLButtonElement;
      expect(cancelBtn).toBeTruthy();
      cancelBtn.click();

      expect(onPurchaseCancelled).toHaveBeenCalledWith('item-001');
    });
  });

  describe('Successful Purchase Flow', () => {
    beforeEach(() => {
      // Mock successful purchase API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(MOCK_PURCHASE_RESULT),
      });
    });

    it('should fire onPurchaseSuccess, onPurchaseComplete, and onBalanceUpdate on successful purchase', async () => {
      const onPurchaseSuccess = vi.fn();
      const onPurchaseComplete = vi.fn();
      const onBalanceUpdate = vi.fn();

      sdk.on('onPurchaseSuccess', onPurchaseSuccess);
      sdk.on('onPurchaseComplete', onPurchaseComplete);
      sdk.on('onBalanceUpdate', onBalanceUpdate);

      sdk.requestPurchase('item-001');

      // Simulate confirm button click
      const confirmBtn = document.getElementById('gw-purchase-confirm-btn') as HTMLButtonElement;
      expect(confirmBtn).toBeTruthy();

      // Wait for async purchase to complete
      confirmBtn.click();
      await new Promise(resolve => setTimeout(resolve, 50)); // Allow async operations

      expect(onPurchaseSuccess).toHaveBeenCalledWith(MOCK_PURCHASE_RESULT);
      expect(onPurchaseComplete).toHaveBeenCalledWith('item-001');
      expect(onBalanceUpdate).toHaveBeenCalledWith(100); // remainingBalance from mock
    });

    it('should call purchase API with correct parameters', async () => {
      sdk.requestPurchase('item-001');

      const confirmBtn = document.getElementById('gw-purchase-confirm-btn') as HTMLButtonElement;
      confirmBtn.click();
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.example.com/v1/sessions/session-events-001/purchases',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-jwt-token',
          }),
          body: expect.stringContaining('"item_id":"item-001"'),
        })
      );
    });
  });

  describe('Failed Purchase Flow', () => {
    beforeEach(() => {
      // Mock failed purchase API response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve(MOCK_PURCHASE_ERROR),
      });
    });

    it('should fire onPurchaseError on purchase failure', async () => {
      const onPurchaseError = vi.fn();
      sdk.on('onPurchaseError', onPurchaseError);

      sdk.requestPurchase('item-001');

      const confirmBtn = document.getElementById('gw-purchase-confirm-btn') as HTMLButtonElement;
      confirmBtn.click();
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(onPurchaseError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.any(String),
          code: 'validation_failed',
          itemId: 'item-001',
        })
      );
    });

    it('should not fire onPurchaseComplete or onBalanceUpdate on purchase failure', async () => {
      const onPurchaseComplete = vi.fn();
      const onBalanceUpdate = vi.fn();

      sdk.on('onPurchaseComplete', onPurchaseComplete);
      sdk.on('onBalanceUpdate', onBalanceUpdate);

      sdk.requestPurchase('item-001');

      const confirmBtn = document.getElementById('gw-purchase-confirm-btn') as HTMLButtonElement;
      confirmBtn.click();
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(onPurchaseComplete).not.toHaveBeenCalled();
      expect(onBalanceUpdate).not.toHaveBeenCalled();
    });
  });

  describe('PurchaseModal DOM Integration', () => {
    it('should render modal with correct item information', () => {
      sdk.requestPurchase('item-001');

      const modal = document.getElementById('gw-purchase-modal');
      expect(modal).toBeTruthy();

      // Check for modal title
      const title = document.getElementById('gw-purchase-modal-title');
      expect(title?.textContent).toBe('Confirm Purchase');

      // Check for buttons
      const confirmBtn = document.getElementById('gw-purchase-confirm-btn');
      const cancelBtn = document.getElementById('gw-purchase-cancel-btn');
      expect(confirmBtn).toBeTruthy();
      expect(cancelBtn).toBeTruthy();
    });

    it('should clean up modal from DOM when hidden', () => {
      sdk.requestPurchase('item-001');

      let modal = document.getElementById('gw-purchase-modal');
      expect(modal).toBeTruthy();

      // Hide modal
      (sdk as any).purchaseModal.hide();

      modal = document.getElementById('gw-purchase-modal');
      expect(modal).toBeFalsy();
    });

    it('should prevent multiple modals from being shown simultaneously', () => {
      sdk.requestPurchase('item-001');
      sdk.requestPurchase('item-002'); // Second call should hide first modal

      const modals = document.querySelectorAll('[id^="gw-purchase"]');
      expect(modals.length).toBe(1); // Only one modal should exist
    });
  });

  describe('Event Signature Validation', () => {
    it('should call onPurchaseStart with correct signature', () => {
      const onPurchaseStart = vi.fn();
      sdk.on('onPurchaseStart', onPurchaseStart);

      sdk.requestPurchase('test-item');

      expect(onPurchaseStart).toHaveBeenCalledWith({
        itemId: 'test-item',
        quantity: 1,
      });
      expect(onPurchaseStart).toHaveBeenCalledTimes(1);
    });

    it('should call onPurchaseSuccess with PurchaseResult object', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(MOCK_PURCHASE_RESULT),
      });

      const onPurchaseSuccess = vi.fn();
      sdk.on('onPurchaseSuccess', onPurchaseSuccess);

      sdk.requestPurchase('item-001');
      const confirmBtn = document.getElementById('gw-purchase-confirm-btn') as HTMLButtonElement;
      confirmBtn.click();
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(onPurchaseSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          purchaseId: expect.any(String),
          itemId: expect.any(String),
          itemName: expect.any(String),
          quantity: expect.any(Number),
          totalTokenCost: expect.any(Number),
          remainingBalance: expect.any(Number),
          purchasedAt: expect.any(String),
          status: 'completed',
        })
      );
    });

    it('should call onBalanceUpdate with number value', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(MOCK_PURCHASE_RESULT),
      });

      const onBalanceUpdate = vi.fn();
      sdk.on('onBalanceUpdate', onBalanceUpdate);

      sdk.requestPurchase('item-001');
      const confirmBtn = document.getElementById('gw-purchase-confirm-btn') as HTMLButtonElement;
      confirmBtn.click();
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(onBalanceUpdate).toHaveBeenCalledWith(100);
      expect(typeof onBalanceUpdate.mock.calls[0][0]).toBe('number');
    });
  });
});