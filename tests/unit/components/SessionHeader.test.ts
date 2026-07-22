// @vitest-environment jsdom

/**
 * Unit tests for SessionHeader component (GW-2517)
 *
 * Tests: balance display, modal open/close, mount/unmount lifecycle.
 * Focused component-level tests complementing the broader session-header.test.ts.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SessionHeader } from '../../../src/ui/SessionHeader';
import { PurchaseModal } from '../../../src/ui/PurchaseModal';
import type { TokenBalance, ExtensionCostResult } from '../../../src/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockSDK(overrides: Record<string, unknown> = {}) {
  const handlers: Record<string, ((...args: unknown[]) => void)[]> = {};

  const sdk = {
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      handlers[event] = handlers[event] ?? [];
      handlers[event].push(handler);
    }),
    getTokenBalance: vi
      .fn()
      .mockResolvedValue({ balance: 250, unit: 'SMART' } as TokenBalance),
    getExtensionCost: vi.fn().mockResolvedValue({
      extensionMinutes: 15,
      tokenCost: 20,
      newExpiresAt: new Date(Date.now() + 900000).toISOString(),
    } as ExtensionCostResult),
    extendSession: vi.fn().mockResolvedValue(undefined),
    _emit(event: string, payload: unknown) {
      (handlers[event] ?? []).forEach((h) => h(payload));
    },
    ...overrides,
  };

  return sdk;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SessionHeader component', () => {
  let container: HTMLDivElement;
  let header: SessionHeader;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    header = new SessionHeader('light');
  });

  afterEach(() => {
    header.destroy();
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Balance display
  // -------------------------------------------------------------------------

  describe('balance display', () => {
    it('shows placeholder balance text before SDK resolves', () => {
      const sdk = makeMockSDK({
        getTokenBalance: vi.fn().mockReturnValue(new Promise(() => {})),
      });

      header.mount(container, { getTime: () => '10:00', sdk: sdk as never });

      const balanceEl = container.querySelector('.gw-header-balance') as HTMLElement;
      expect(balanceEl).not.toBeNull();
      expect(balanceEl.textContent).toBe('Balance: -- SMART');
    });

    it('updates balance display after SDK resolves', async () => {
      const sdk = makeMockSDK();

      header.mount(container, { getTime: () => '10:00', sdk: sdk as never });

      await new Promise((resolve) => setTimeout(resolve, 0));

      const balanceEl = container.querySelector('.gw-header-balance') as HTMLElement;
      expect(balanceEl.textContent).toBe('Balance: 250 SMART');
    });

    it('updates balance when onBalanceChange event fires', async () => {
      const sdk = makeMockSDK();

      header.mount(container, { getTime: () => '10:00', sdk: sdk as never });

      await vi.waitFor(() => {
        const el = container.querySelector('.gw-header-balance') as HTMLElement;
        return el?.textContent === 'Balance: 250 SMART';
      });

      sdk._emit('onBalanceChange', { balance: 180, unit: 'SMART' });

      const balanceEl = container.querySelector('.gw-header-balance') as HTMLElement;
      expect(balanceEl.textContent).toBe('Balance: 180 SMART');
    });

    it('registers onBalanceChange event listener on mount', () => {
      const sdk = makeMockSDK();

      header.mount(container, { getTime: () => '10:00', sdk: sdk as never });

      const registeredEvents = (sdk.on as ReturnType<typeof vi.fn>).mock.calls.map(
        (c: any) => c[0],
      );
      expect(registeredEvents).toContain('onBalanceChange');
    });
  });

  // -------------------------------------------------------------------------
  // Modal open/close
  // -------------------------------------------------------------------------

  describe('modal open/close', () => {
    it('shows the Extend button when SDK is provided', () => {
      const sdk = makeMockSDK();

      header.mount(container, { getTime: () => '10:00', sdk: sdk as never });

      const buttons = Array.from(container.querySelectorAll('button'));
      const extendBtn = buttons.find((b) => b.textContent?.trim() === 'Extend');
      expect(extendBtn).toBeDefined();
    });

    it('opens PurchaseModal when Extend button is clicked', async () => {
      const sdk = makeMockSDK();
      const showSpy = vi.spyOn(PurchaseModal.prototype, 'show');

      header.mount(container, { getTime: () => '10:00', sdk: sdk as never });

      const extendBtn = Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent?.trim() === 'Extend',
      ) as HTMLButtonElement;

      extendBtn.click();

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(showSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          item: expect.objectContaining({
            id: 'session-extension',
            tokenCost: 20,
          }),
          currentBalance: 250,
        }),
      );
    });

    it('hides Extend button when no SDK is provided', () => {
      header.mount(container, { getTime: () => '10:00' });

      const buttons = Array.from(container.querySelectorAll('button'));
      const extendBtn = buttons.find((b) => b.textContent?.trim() === 'Extend');
      expect(extendBtn).toBeUndefined();
    });

    it('calls extendSession when PurchaseModal onConfirm is invoked', async () => {
      const sdk = makeMockSDK();
      let capturedOnConfirm: ((qty: number) => Promise<void>) | undefined;

      vi.spyOn(PurchaseModal.prototype, 'show').mockImplementation((opts) => {
        capturedOnConfirm = opts.onConfirm;
      });

      header.mount(container, { getTime: () => '10:00', sdk: sdk as never });

      const extendBtn = Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent?.trim() === 'Extend',
      ) as HTMLButtonElement;

      extendBtn.click();

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(capturedOnConfirm).toBeDefined();
      await capturedOnConfirm!(1);

      expect(sdk.extendSession).toHaveBeenCalledWith({ skipConfirmation: true });
    });
  });

  // -------------------------------------------------------------------------
  // Mount / unmount lifecycle
  // -------------------------------------------------------------------------

  describe('mount/unmount lifecycle', () => {
    it('creates #gw-session-header element on mount', () => {
      header.mount(container, { getTime: () => '15:00' });

      expect(container.querySelector('#gw-session-header')).not.toBeNull();
    });

    it('reports isMounted() as true after mount', () => {
      header.mount(container, { getTime: () => '15:00' });

      expect(header.isMounted()).toBe(true);
    });

    it('removes #gw-session-header element on unmount', () => {
      header.mount(container, { getTime: () => '15:00' });
      header.unmount();

      expect(container.querySelector('#gw-session-header')).toBeNull();
    });

    it('reports isMounted() as false after unmount', () => {
      header.mount(container, { getTime: () => '15:00' });
      header.unmount();

      expect(header.isMounted()).toBe(false);
    });

    it('renders the End button when onEnd callback is provided', () => {
      const onEnd = vi.fn();

      header.mount(container, { getTime: () => '15:00', onEnd });

      const buttons = Array.from(container.querySelectorAll('button'));
      const endBtn = buttons.find((b) => b.textContent?.trim() === 'End');
      expect(endBtn).toBeDefined();
    });

    it('calls onEnd callback when End button is clicked', () => {
      const onEnd = vi.fn();

      header.mount(container, { getTime: () => '15:00', onEnd });

      const endBtn = Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent?.trim() === 'End',
      ) as HTMLButtonElement;

      endBtn.click();

      expect(onEnd).toHaveBeenCalledOnce();
    });

    it('remounts cleanly when mount is called twice', () => {
      header.mount(container, { getTime: () => '10:00' });
      header.mount(container, { getTime: () => '20:00' });

      // Should only have one session header element after remount
      const headers = container.querySelectorAll('#gw-session-header');
      expect(headers).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // Add-ons button and items panel (GW-2527)
  // -------------------------------------------------------------------------

  describe('Add-ons button and items panel', () => {
    it('shows Add-ons button when SDK has available items', async () => {
      const mockItems = [
        {
          id: 'item-1',
          name: 'Premium Feature',
          description: 'Unlock premium functionality',
          userTokenCost: 50,
          status: 'active',
          visibility: 'visible',
        },
      ];

      const sdk = makeMockSDK({
        getAvailableItems: vi.fn().mockResolvedValue(mockItems),
      });

      header.mount(container, { getTime: () => '10:00', sdk: sdk as never });

      await new Promise((resolve) => setTimeout(resolve, 0));

      const buttons = Array.from(container.querySelectorAll('button'));
      const addonsBtn = buttons.find((b) => b.textContent?.trim() === 'Add-ons');
      expect(addonsBtn).toBeDefined();
    });

    it('hides Add-ons button when no items are available', async () => {
      const sdk = makeMockSDK({
        getAvailableItems: vi.fn().mockResolvedValue([]),
      });

      header.mount(container, { getTime: () => '10:00', sdk: sdk as never });

      await new Promise((resolve) => setTimeout(resolve, 0));

      const buttons = Array.from(container.querySelectorAll('button'));
      const addonsBtn = buttons.find((b) => b.textContent?.trim() === 'Add-ons');
      expect(addonsBtn).toBeUndefined();
    });

    it('opens items panel when Add-ons button is clicked', async () => {
      const mockItems = [
        {
          id: 'item-1',
          name: 'Premium Feature',
          description: 'Unlock premium functionality',
          userTokenCost: 50,
          status: 'active',
          visibility: 'visible',
        },
      ];

      const sdk = makeMockSDK({
        getAvailableItems: vi.fn().mockResolvedValue(mockItems),
      });

      header.mount(container, { getTime: () => '10:00', sdk: sdk as never });

      await new Promise((resolve) => setTimeout(resolve, 0));

      const addonsBtn = Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent?.trim() === 'Add-ons',
      ) as HTMLButtonElement;

      addonsBtn.click();

      const itemsPanel = container.querySelector('.gw-items-panel');
      expect(itemsPanel).not.toBeNull();
    });

    it('displays items in the panel with correct information', async () => {
      const mockItems = [
        {
          id: 'item-1',
          name: 'Premium Feature',
          description: 'Unlock premium functionality',
          userTokenCost: 50,
          status: 'active',
          visibility: 'visible',
        },
        {
          id: 'item-2',
          name: 'Extra Storage',
          description: 'Get additional storage space',
          userTokenCost: 25,
          status: 'active',
          visibility: 'visible',
        },
      ];

      const sdk = makeMockSDK({
        getAvailableItems: vi.fn().mockResolvedValue(mockItems),
      });

      header.mount(container, { getTime: () => '10:00', sdk: sdk as never });

      await new Promise((resolve) => setTimeout(resolve, 0));

      const addonsBtn = Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent?.trim() === 'Add-ons',
      ) as HTMLButtonElement;

      addonsBtn.click();

      const itemElements = container.querySelectorAll('.gw-item');
      expect(itemElements).toHaveLength(2);

      // Check first item
      const firstItem = itemElements[0] as HTMLElement;
      expect(firstItem.textContent).toContain('Premium Feature');
      expect(firstItem.textContent).toContain('50 SMART');

      // Check second item
      const secondItem = itemElements[1] as HTMLElement;
      expect(secondItem.textContent).toContain('Extra Storage');
      expect(secondItem.textContent).toContain('25 SMART');
    });

    it('opens PurchaseModal when item is clicked', async () => {
      const mockItems = [
        {
          id: 'item-1',
          name: 'Premium Feature',
          description: 'Unlock premium functionality',
          userTokenCost: 50,
          status: 'active',
          visibility: 'visible',
        },
      ];

      const sdk = makeMockSDK({
        getAvailableItems: vi.fn().mockResolvedValue(mockItems),
      });

      const showSpy = vi.spyOn(PurchaseModal.prototype, 'show');

      header.mount(container, { getTime: () => '10:00', sdk: sdk as never });

      await new Promise((resolve) => setTimeout(resolve, 0));

      const addonsBtn = Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent?.trim() === 'Add-ons',
      ) as HTMLButtonElement;

      addonsBtn.click();

      const firstItem = container.querySelector('.gw-item') as HTMLElement;
      firstItem.click();

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(showSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          item: expect.objectContaining({
            id: 'item-1',
            name: 'Premium Feature',
            tokenCost: 50,
          }),
          currentBalance: 250,
        }),
      );
    });
  });
});
