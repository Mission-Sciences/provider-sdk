// @vitest-environment jsdom

/**
 * SessionHeader unit tests
 * Tests balance display, balance updates via onBalanceChange, PurchaseModal triggering,
 * and session extension timer updates.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionHeader } from '../../src/ui/SessionHeader';
import { PurchaseModal } from '../../src/ui/PurchaseModal';
import { TokenBalance, ExtensionCostResult } from '../../src/types';

// --- Helpers ---

function buildMockSDK(overrides: Partial<ReturnType<typeof makeMockSDK>> = {}) {
  return { ...makeMockSDK(), ...overrides };
}

function makeMockSDK() {
  const handlers: Record<string, ((...args: unknown[]) => void)[]> = {};

  const sdk = {
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      handlers[event] = handlers[event] ?? [];
      handlers[event].push(handler);
    }),
    getTokenBalance: vi.fn().mockResolvedValue({ balance: 100, unit: 'SMART' } as TokenBalance),
    getExtensionCost: vi.fn().mockResolvedValue({ extensionMinutes: 15, tokenCost: 10, newExpiresAt: new Date(Date.now() + 900000).toISOString() } as ExtensionCostResult),
    extendSession: vi.fn().mockResolvedValue(undefined),
    // Helper to emit events in tests
    _emit(event: string, payload: unknown) {
      (handlers[event] ?? []).forEach((h) => h(payload));
    },
  };

  return sdk;
}

// --- Tests ---

describe('SessionHeader', () => {
  let container: HTMLDivElement;
  let header: SessionHeader;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    header = new SessionHeader('light');
  });

  afterEach(() => {
    header.destroy();
    document.body.removeChild(container);
  });

  describe('balance display', () => {
    it('renders balance placeholder before SDK resolves', () => {
      const sdk = buildMockSDK({
        // Never resolves during this synchronous check
        getTokenBalance: vi.fn().mockReturnValue(new Promise(() => {})),
      });

      header.mount(container, { getTime: () => '10:00', sdk: sdk as never });

      const balanceEl = container.querySelector('.gw-header-balance') as HTMLElement;
      expect(balanceEl).not.toBeNull();
      expect(balanceEl.textContent).toBe('Balance: -- SMART');
    });

    it('renders correct balance after SDK resolves', async () => {
      const sdk = buildMockSDK();

      header.mount(container, { getTime: () => '10:00', sdk: sdk as never });

      // Flush all microtasks / promises so the async refreshBalance() call completes
      await new Promise((resolve) => setTimeout(resolve, 0));

      const balanceEl = container.querySelector('.gw-header-balance') as HTMLElement;
      expect(balanceEl.textContent).toBe('Balance: 100 SMART');
    });

    it('mounts with timer display', () => {
      const sdk = buildMockSDK();
      header.mount(container, { getTime: () => '05:30', sdk: sdk as never });

      const timeEl = container.querySelector('#gw-session-time') as HTMLElement;
      expect(timeEl).not.toBeNull();
      expect(timeEl.textContent).toBe('05:30');
    });
  });

  describe('balance updates via onBalanceChange event', () => {
    it('updates balance display when onBalanceChange fires', async () => {
      const sdk = buildMockSDK();
      header.mount(container, { getTime: () => '10:00', sdk: sdk as never });

      // Wait for initial balance load
      await vi.waitFor(() => {
        const el = container.querySelector('.gw-header-balance') as HTMLElement;
        return el?.textContent === 'Balance: 100 SMART';
      });

      // Simulate balance change event from SDK
      sdk._emit('onBalanceChange', { balance: 75, unit: 'SMART' });

      const balanceEl = container.querySelector('.gw-header-balance') as HTMLElement;
      expect(balanceEl.textContent).toBe('Balance: 75 SMART');
    });

    it('registers onBalanceChange and onSessionExtended listeners on mount', () => {
      const sdk = buildMockSDK();
      header.mount(container, { getTime: () => '10:00', sdk: sdk as never });

      const registeredEvents = sdk.on.mock.calls.map((call) => call[0]);
      expect(registeredEvents).toContain('onBalanceChange');
      expect(registeredEvents).toContain('onSessionExtended');
    });
  });

  describe('extend button triggers PurchaseModal', () => {
    it('renders Extend button when SDK is provided', () => {
      const sdk = buildMockSDK();
      header.mount(container, { getTime: () => '10:00', sdk: sdk as never });

      const buttons = container.querySelectorAll('button');
      const extendBtn = Array.from(buttons).find((b) => b.textContent?.trim() === 'Extend');
      expect(extendBtn).toBeDefined();
    });

    it('does not render Extend button when SDK is not provided', () => {
      header.mount(container, { getTime: () => '10:00' });

      const buttons = container.querySelectorAll('button');
      const extendBtn = Array.from(buttons).find((b) => b.textContent?.trim() === 'Extend');
      expect(extendBtn).toBeUndefined();
    });

    it('calls getExtensionCost and getTokenBalance when Extend is clicked', async () => {
      const sdk = buildMockSDK();
      header.mount(container, { getTime: () => '10:00', sdk: sdk as never });

      const buttons = container.querySelectorAll('button');
      const extendBtn = Array.from(buttons).find((b) => b.textContent?.trim() === 'Extend') as HTMLButtonElement;

      extendBtn.click();

      await vi.waitFor(() => {
        return sdk.getExtensionCost.mock.calls.length > 0;
      });

      expect(sdk.getExtensionCost).toHaveBeenCalled();
      expect(sdk.getTokenBalance).toHaveBeenCalled();
    });

    it('shows PurchaseModal after Extend button click', async () => {
      const sdk = buildMockSDK();
      const showSpy = vi.spyOn(PurchaseModal.prototype, 'show');

      header.mount(container, { getTime: () => '10:00', sdk: sdk as never });

      const buttons = container.querySelectorAll('button');
      const extendBtn = Array.from(buttons).find((b) => b.textContent?.trim() === 'Extend') as HTMLButtonElement;

      extendBtn.click();

      // Wait for both getExtensionCost and getTokenBalance promises to resolve
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(showSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          item: expect.objectContaining({ id: 'session-extension', tokenCost: 10, name: 'Extend Session (+15 min)' }),
          currentBalance: 100,
        })
      );

      showSpy.mockRestore();
    });

    it('calls extendSession when PurchaseModal onConfirm is invoked', async () => {
      const sdk = buildMockSDK();
      let capturedOnConfirm: ((quantity: number) => Promise<void>) | undefined;

      vi.spyOn(PurchaseModal.prototype, 'show').mockImplementation((opts) => {
        capturedOnConfirm = opts.onConfirm;
      });

      header.mount(container, { getTime: () => '10:00', sdk: sdk as never });

      const buttons = container.querySelectorAll('button');
      const extendBtn = Array.from(buttons).find((b) => b.textContent?.trim() === 'Extend') as HTMLButtonElement;
      extendBtn.click();

      // Wait for both promises (getExtensionCost + getTokenBalance) to resolve
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(capturedOnConfirm).toBeDefined();
      await capturedOnConfirm!(1);

      expect(sdk.extendSession).toHaveBeenCalledWith({ skipConfirmation: true });

      vi.restoreAllMocks();
    });
  });

  describe('session extension updates timer', () => {
    it('updates timer text when onSessionExtended fires', async () => {
      let getTimeCalls = 0;
      const getTime = vi.fn(() => {
        getTimeCalls++;
        return getTimeCalls <= 1 ? '10:00' : '25:00';
      });

      const sdk = buildMockSDK();
      header.mount(container, { getTime, sdk: sdk as never });

      // Wait for initial render
      await vi.waitFor(() => {
        const el = container.querySelector('#gw-session-time') as HTMLElement;
        return el?.textContent === '10:00';
      });

      // Simulate extension event
      sdk._emit('onSessionExtended', { additionalMinutes: 15, newExpiresAt: Date.now() / 1000 + 1500 });

      const timeEl = container.querySelector('#gw-session-time') as HTMLElement;
      // After the event handler, getTime is called again synchronously
      expect(getTime).toHaveBeenCalled();
      // The element now shows the new time returned by the updated getTime
      expect(timeEl.textContent).toBe('25:00');
    });
  });

  describe('cleanup', () => {
    it('unmounts cleanly and removes the element', () => {
      const sdk = buildMockSDK();
      header.mount(container, { getTime: () => '10:00', sdk: sdk as never });

      expect(container.querySelector('#gw-session-header')).not.toBeNull();
      header.unmount();
      expect(container.querySelector('#gw-session-header')).toBeNull();
    });

    it('isMounted reflects mounted state', () => {
      header.mount(container, { getTime: () => '10:00' });
      expect(header.isMounted()).toBe(true);

      header.unmount();
      expect(header.isMounted()).toBe(false);
    });
  });
});
