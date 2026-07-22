// @vitest-environment jsdom

/**
 * Unit tests for PurchaseModal DOM component (GW-2517)
 *
 * Tests: renders price and item details, confirm handler, cancel handler,
 *        insufficient balance state, success notification.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PurchaseModal } from '../../../src/ui/PurchaseModal';
import type { PurchaseResult } from '../../../src/types/purchases';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildItem(overrides: Partial<{ id: string; name: string; tokenCost: number }> = {}) {
  return {
    id: overrides.id ?? 'item-001',
    name: overrides.name ?? 'Premium Export',
    tokenCost: overrides.tokenCost ?? 27,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PurchaseModal', () => {
  let modal: PurchaseModal;

  beforeEach(() => {
    modal = new PurchaseModal('light');
  });

  afterEach(() => {
    modal.hide();
    // Clean up any stray modals
    document.querySelectorAll('#gw-purchase-modal, #gw-purchase-success-modal').forEach((el) => {
      el.parentNode?.removeChild(el);
    });
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------

  describe('renders price and item details', () => {
    it('renders modal to the DOM when show() is called', () => {
      modal.show({
        item: buildItem(),
        currentBalance: 100,
        onConfirm: vi.fn().mockResolvedValue(undefined),
      });

      expect(document.getElementById('gw-purchase-modal')).not.toBeNull();
    });

    it('displays the item name in the modal body', () => {
      modal.show({
        item: buildItem({ name: 'Deep Scan' }),
        currentBalance: 100,
        onConfirm: vi.fn().mockResolvedValue(undefined),
      });

      const modalEl = document.getElementById('gw-purchase-modal')!;
      expect(modalEl.innerHTML).toContain('Deep Scan');
    });

    it('displays the total cost in SMART tokens', () => {
      modal.show({
        item: buildItem({ tokenCost: 50 }),
        quantity: 2,
        currentBalance: 200,
        onConfirm: vi.fn().mockResolvedValue(undefined),
      });

      // quantity=2, cost=50 → total=100
      const modalEl = document.getElementById('gw-purchase-modal')!;
      expect(modalEl.innerHTML).toContain('100 SMART tokens');
    });

    it('displays the current balance', () => {
      modal.show({
        item: buildItem(),
        currentBalance: 473,
        onConfirm: vi.fn().mockResolvedValue(undefined),
      });

      const modalEl = document.getElementById('gw-purchase-modal')!;
      expect(modalEl.innerHTML).toContain('473 SMART tokens');
    });

    it('renders a "Confirm Purchase" button', () => {
      modal.show({
        item: buildItem(),
        currentBalance: 100,
        onConfirm: vi.fn().mockResolvedValue(undefined),
      });

      const confirmBtn = document.getElementById('gw-purchase-confirm-btn') as HTMLButtonElement;
      expect(confirmBtn).not.toBeNull();
      expect(confirmBtn.textContent?.trim()).toBe('Confirm Purchase');
    });

    it('renders a "Cancel" button', () => {
      modal.show({
        item: buildItem(),
        currentBalance: 100,
        onConfirm: vi.fn().mockResolvedValue(undefined),
      });

      const cancelBtn = document.getElementById('gw-purchase-cancel-btn') as HTMLButtonElement;
      expect(cancelBtn).not.toBeNull();
      expect(cancelBtn.textContent?.trim()).toBe('Cancel');
    });

    it('sets aria-modal and role=dialog for accessibility', () => {
      modal.show({
        item: buildItem(),
        currentBalance: 100,
        onConfirm: vi.fn().mockResolvedValue(undefined),
      });

      const modalEl = document.getElementById('gw-purchase-modal')!;
      expect(modalEl.getAttribute('role')).toBe('dialog');
      expect(modalEl.getAttribute('aria-modal')).toBe('true');
    });
  });

  // -------------------------------------------------------------------------
  // Confirm handler
  // -------------------------------------------------------------------------

  describe('confirm handler', () => {
    it('calls onConfirm with the quantity when Confirm is clicked', async () => {
      const onConfirm = vi.fn().mockResolvedValue(undefined);

      modal.show({
        item: buildItem(),
        quantity: 2,
        currentBalance: 200,
        onConfirm,
      });

      const confirmBtn = document.getElementById('gw-purchase-confirm-btn') as HTMLButtonElement;
      confirmBtn.click();

      await vi.waitFor(() => onConfirm.mock.calls.length > 0);

      expect(onConfirm).toHaveBeenCalledWith(2);
    });

    it('hides modal after successful confirm', async () => {
      const onConfirm = vi.fn().mockResolvedValue(undefined);

      modal.show({
        item: buildItem(),
        currentBalance: 100,
        onConfirm,
      });

      const confirmBtn = document.getElementById('gw-purchase-confirm-btn') as HTMLButtonElement;
      confirmBtn.click();

      // Flush all pending microtasks and timers so the async click handler completes
      await vi.waitFor(() => expect(onConfirm).toHaveBeenCalled());
      // Give the async handler one more tick to call hide() after onConfirm resolves
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(modal.isShown()).toBe(false);
    });

    it('shows error message when onConfirm rejects', async () => {
      const onConfirm = vi.fn().mockRejectedValue(new Error('Purchase failed'));

      modal.show({
        item: buildItem(),
        currentBalance: 100,
        onConfirm,
      });

      const confirmBtn = document.getElementById('gw-purchase-confirm-btn') as HTMLButtonElement;
      confirmBtn.click();

      // Flush all pending microtasks and timers so the async click handler completes
      await vi.waitFor(() => expect(onConfirm).toHaveBeenCalled());
      // Give the async handler one more tick to update the error element after rejection
      await new Promise((resolve) => setTimeout(resolve, 0));

      const errorEl = document.getElementById('gw-purchase-error')!;
      expect(errorEl.textContent).toContain('Purchase failed');
    });
  });

  // -------------------------------------------------------------------------
  // Cancel handler
  // -------------------------------------------------------------------------

  describe('cancel handler', () => {
    it('calls onCancel when Cancel button is clicked', () => {
      const onCancel = vi.fn();

      modal.show({
        item: buildItem(),
        currentBalance: 100,
        onConfirm: vi.fn().mockResolvedValue(undefined),
        onCancel,
      });

      const cancelBtn = document.getElementById('gw-purchase-cancel-btn') as HTMLButtonElement;
      cancelBtn.click();

      expect(onCancel).toHaveBeenCalledOnce();
    });

    it('hides modal when Cancel is clicked', () => {
      modal.show({
        item: buildItem(),
        currentBalance: 100,
        onConfirm: vi.fn().mockResolvedValue(undefined),
        onCancel: vi.fn(),
      });

      const cancelBtn = document.getElementById('gw-purchase-cancel-btn') as HTMLButtonElement;
      cancelBtn.click();

      expect(document.getElementById('gw-purchase-modal')).toBeNull();
      expect(modal.isShown()).toBe(false);
    });

    it('hides modal on cancel even without an onCancel callback', () => {
      modal.show({
        item: buildItem(),
        currentBalance: 100,
        onConfirm: vi.fn().mockResolvedValue(undefined),
      });

      const cancelBtn = document.getElementById('gw-purchase-cancel-btn') as HTMLButtonElement;
      cancelBtn.click();

      expect(document.getElementById('gw-purchase-modal')).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Insufficient balance
  // -------------------------------------------------------------------------

  describe('insufficient balance', () => {
    it('disables Confirm button when balance is insufficient', () => {
      modal.show({
        item: buildItem({ tokenCost: 100 }),
        currentBalance: 50, // less than 100
        onConfirm: vi.fn().mockResolvedValue(undefined),
      });

      const confirmBtn = document.getElementById('gw-purchase-confirm-btn') as HTMLButtonElement;
      expect(confirmBtn.disabled).toBe(true);
    });

    it('shows insufficient balance message when balance is too low', () => {
      modal.show({
        item: buildItem({ tokenCost: 100 }),
        currentBalance: 50,
        onConfirm: vi.fn().mockResolvedValue(undefined),
      });

      const modalEl = document.getElementById('gw-purchase-modal')!;
      expect(modalEl.innerHTML).toContain('Insufficient balance');
    });

    it('enables Confirm button when balance is exactly sufficient', () => {
      modal.show({
        item: buildItem({ tokenCost: 27 }),
        currentBalance: 27,
        onConfirm: vi.fn().mockResolvedValue(undefined),
      });

      const confirmBtn = document.getElementById('gw-purchase-confirm-btn') as HTMLButtonElement;
      expect(confirmBtn.disabled).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // isShown / hide
  // -------------------------------------------------------------------------

  describe('isShown() and hide()', () => {
    it('returns false before show() is called', () => {
      expect(modal.isShown()).toBe(false);
    });

    it('returns true after show() is called', () => {
      modal.show({
        item: buildItem(),
        currentBalance: 100,
        onConfirm: vi.fn().mockResolvedValue(undefined),
      });

      expect(modal.isShown()).toBe(true);
    });

    it('returns false after hide() is called', () => {
      modal.show({
        item: buildItem(),
        currentBalance: 100,
        onConfirm: vi.fn().mockResolvedValue(undefined),
      });

      modal.hide();

      expect(modal.isShown()).toBe(false);
      expect(document.getElementById('gw-purchase-modal')).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // showSuccess
  // -------------------------------------------------------------------------

  describe('showSuccess()', () => {
    it('renders a success notification with the remaining balance', () => {
      const result: PurchaseResult = {
        purchaseId: 'purchase-001',
        itemId: 'item-001',
        itemName: 'Premium Export',
        quantity: 1,
        totalTokenCost: 27,
        remainingBalance: 473,
        purchasedAt: '2026-02-10T15:30:00Z',
        status: 'completed',
      };

      modal.showSuccess(result, 100000); // long duration to avoid auto-hide in test

      const successEl = document.getElementById('gw-purchase-success-modal');
      expect(successEl).not.toBeNull();
      expect(successEl!.innerHTML).toContain('473 SMART tokens');
    });
  });
});
