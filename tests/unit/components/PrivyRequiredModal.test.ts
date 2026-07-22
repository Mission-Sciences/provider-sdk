// @vitest-environment jsdom

/**
 * Unit tests for PrivyRequiredModal DOM component (GW-4161)
 *
 * Tests: renders upgrade prompt, deep-link URL, cancel handler,
 *        onUpgrade callback, isShown/hide, accessibility.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PrivyRequiredModal } from '../../../src/ui/PrivyRequiredModal';

describe('PrivyRequiredModal', () => {
  let modal: PrivyRequiredModal;

  beforeEach(() => {
    modal = new PrivyRequiredModal('light');
  });

  afterEach(() => {
    modal.hide();
    document.querySelectorAll('#gw-privy-required-modal').forEach((el) => {
      el.parentNode?.removeChild(el);
    });
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // buildUpgradeUrl (static)
  // -------------------------------------------------------------------------

  describe('buildUpgradeUrl()', () => {
    it('uses default base URL when not provided', () => {
      const url = PrivyRequiredModal.buildUpgradeUrl();
      expect(url).toBe('https://platform.generalwisdom.com/settings?privy=upgrade');
    });

    it('uses supplied gwBaseUrl', () => {
      const url = PrivyRequiredModal.buildUpgradeUrl('https://dev.generalwisdom.com');
      expect(url).toBe('https://dev.generalwisdom.com/settings?privy=upgrade');
    });

    it('strips trailing slash from gwBaseUrl', () => {
      const url = PrivyRequiredModal.buildUpgradeUrl('https://dev.generalwisdom.com/');
      expect(url).toBe('https://dev.generalwisdom.com/settings?privy=upgrade');
    });
  });

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------

  describe('show()', () => {
    it('renders modal to the DOM', () => {
      modal.show({ requiredLevel: 1, currentLevel: 0 });
      expect(document.getElementById('gw-privy-required-modal')).not.toBeNull();
    });

    it('displays the required Privy level', () => {
      modal.show({ requiredLevel: 1, currentLevel: 0 });
      const el = document.getElementById('gw-privy-required-modal')!;
      expect(el.innerHTML).toContain('Privy 1');
    });

    it('renders an upgrade link pointing to the correct URL', () => {
      modal.show({ requiredLevel: 1, currentLevel: 0 });
      const upgradeBtn = document.getElementById('gw-privy-upgrade-btn') as HTMLAnchorElement;
      expect(upgradeBtn).not.toBeNull();
      expect(upgradeBtn.href).toBe('https://platform.generalwisdom.com/settings?privy=upgrade');
    });

    it('uses supplied gwBaseUrl in the upgrade link', () => {
      modal.show({
        requiredLevel: 1,
        currentLevel: 0,
        gwBaseUrl: 'https://dev.generalwisdom.com',
      });
      const upgradeBtn = document.getElementById('gw-privy-upgrade-btn') as HTMLAnchorElement;
      expect(upgradeBtn.href).toBe('https://dev.generalwisdom.com/settings?privy=upgrade');
    });

    it('renders a Cancel button', () => {
      modal.show({ requiredLevel: 1, currentLevel: 0 });
      const cancelBtn = document.getElementById('gw-privy-cancel-btn') as HTMLButtonElement;
      expect(cancelBtn).not.toBeNull();
    });

    it('sets role=dialog and aria-modal for accessibility', () => {
      modal.show({ requiredLevel: 1, currentLevel: 0 });
      const el = document.getElementById('gw-privy-required-modal')!;
      expect(el.getAttribute('role')).toBe('dialog');
      expect(el.getAttribute('aria-modal')).toBe('true');
    });

    it('has labelledby attribute pointing to title element', () => {
      modal.show({ requiredLevel: 1, currentLevel: 0 });
      const el = document.getElementById('gw-privy-required-modal')!;
      expect(el.getAttribute('aria-labelledby')).toBe('gw-privy-required-title');
      expect(document.getElementById('gw-privy-required-title')).not.toBeNull();
    });

    it('replaces any existing modal when show() is called twice', () => {
      modal.show({ requiredLevel: 1, currentLevel: 0 });
      modal.show({ requiredLevel: 1, currentLevel: 0 });
      expect(document.querySelectorAll('#gw-privy-required-modal').length).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // Cancel handler
  // -------------------------------------------------------------------------

  describe('cancel handler', () => {
    it('hides modal when Cancel is clicked', () => {
      modal.show({ requiredLevel: 1, currentLevel: 0 });
      const cancelBtn = document.getElementById('gw-privy-cancel-btn') as HTMLButtonElement;
      cancelBtn.click();
      expect(modal.isShown()).toBe(false);
      expect(document.getElementById('gw-privy-required-modal')).toBeNull();
    });

    it('calls onCancel when Cancel is clicked', () => {
      const onCancel = vi.fn();
      modal.show({ requiredLevel: 1, currentLevel: 0, onCancel });
      const cancelBtn = document.getElementById('gw-privy-cancel-btn') as HTMLButtonElement;
      cancelBtn.click();
      expect(onCancel).toHaveBeenCalledOnce();
    });

    it('hides without onCancel callback without error', () => {
      modal.show({ requiredLevel: 1, currentLevel: 0 });
      const cancelBtn = document.getElementById('gw-privy-cancel-btn') as HTMLButtonElement;
      expect(() => cancelBtn.click()).not.toThrow();
      expect(modal.isShown()).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // onUpgrade callback
  // -------------------------------------------------------------------------

  describe('onUpgrade callback', () => {
    it('calls onUpgrade with the upgrade URL when upgrade button is clicked', () => {
      const onUpgrade = vi.fn();
      modal.show({ requiredLevel: 1, currentLevel: 0, onUpgrade });
      const upgradeBtn = document.getElementById('gw-privy-upgrade-btn') as HTMLAnchorElement;
      upgradeBtn.click();
      expect(onUpgrade).toHaveBeenCalledWith(
        'https://platform.generalwisdom.com/settings?privy=upgrade',
      );
    });

    it('hides modal when onUpgrade fires', () => {
      const onUpgrade = vi.fn();
      modal.show({ requiredLevel: 1, currentLevel: 0, onUpgrade });
      const upgradeBtn = document.getElementById('gw-privy-upgrade-btn') as HTMLAnchorElement;
      upgradeBtn.click();
      expect(modal.isShown()).toBe(false);
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
      modal.show({ requiredLevel: 1, currentLevel: 0 });
      expect(modal.isShown()).toBe(true);
    });

    it('returns false after hide() is called', () => {
      modal.show({ requiredLevel: 1, currentLevel: 0 });
      modal.hide();
      expect(modal.isShown()).toBe(false);
      expect(document.getElementById('gw-privy-required-modal')).toBeNull();
    });

    it('hide() is safe to call when modal is not shown', () => {
      expect(() => modal.hide()).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // privyEligibility NOT forwarded
  // -------------------------------------------------------------------------

  describe('privyEligibility is not forwarded', () => {
    it('modal options type does not include a privyEligibility field', () => {
      // TypeScript-level check enforced at compile time; runtime check: the
      // onUpgrade callback only receives the upgrade URL string, not raw data.
      const onUpgrade = vi.fn();
      modal.show({ requiredLevel: 1, currentLevel: 0, onUpgrade });
      const upgradeBtn = document.getElementById('gw-privy-upgrade-btn') as HTMLAnchorElement;
      upgradeBtn.click();
      // onUpgrade is called with exactly one string argument
      expect(onUpgrade).toHaveBeenCalledWith(expect.any(String));
      expect(onUpgrade.mock.calls[0].length).toBe(1);
    });
  });
});
