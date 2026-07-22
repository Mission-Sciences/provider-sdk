// @vitest-environment jsdom

/**
 * Unit tests for PrivyBadge DOM component (GW-4161)
 *
 * Tests: render(), renderHTML(), accessibility attributes, badge text.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PrivyBadge } from '../../../src/ui/PrivyBadge';

describe('PrivyBadge', () => {
  let badge: PrivyBadge;

  beforeEach(() => {
    badge = new PrivyBadge('light');
  });

  afterEach(() => {
    // Clean up any DOM elements added to body
    document.querySelectorAll('.gw-privy-badge').forEach((el) => {
      el.parentNode?.removeChild(el);
    });
  });

  // -------------------------------------------------------------------------
  // render()
  // -------------------------------------------------------------------------

  describe('render()', () => {
    it('returns an HTMLSpanElement', () => {
      const el = badge.render();
      expect(el.tagName).toBe('SPAN');
    });

    it('has class gw-privy-badge', () => {
      const el = badge.render();
      expect(el.className).toBe('gw-privy-badge');
    });

    it('displays "Privy 1" text', () => {
      const el = badge.render();
      expect(el.textContent).toBe('Privy 1');
    });

    it('has aria-label for accessibility', () => {
      const el = badge.render();
      expect(el.getAttribute('aria-label')).toBe('Requires Privy 1 verification');
    });

    it('has title tooltip', () => {
      const el = badge.render();
      expect(el.getAttribute('title')).toBe('This item requires Privy 1 verification');
    });

    it('has inline styles applied', () => {
      const el = badge.render();
      expect(el.style.cssText).toBeTruthy();
    });

    it('can be appended to the DOM', () => {
      const el = badge.render();
      document.body.appendChild(el);
      expect(document.querySelector('.gw-privy-badge')).not.toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // renderHTML()
  // -------------------------------------------------------------------------

  describe('renderHTML()', () => {
    it('returns a string', () => {
      const html = badge.renderHTML();
      expect(typeof html).toBe('string');
    });

    it('contains "Privy 1" text', () => {
      const html = badge.renderHTML();
      expect(html).toContain('Privy 1');
    });

    it('contains the class gw-privy-badge', () => {
      const html = badge.renderHTML();
      expect(html).toContain('gw-privy-badge');
    });

    it('contains aria-label attribute', () => {
      const html = badge.renderHTML();
      expect(html).toContain('aria-label=');
    });

    it('can be injected via innerHTML', () => {
      const container = document.createElement('div');
      container.innerHTML = badge.renderHTML();
      expect(container.querySelector('.gw-privy-badge')).not.toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Dark mode
  // -------------------------------------------------------------------------

  describe('dark theme', () => {
    it('instantiates successfully with dark mode', () => {
      const darkBadge = new PrivyBadge('dark');
      const el = darkBadge.render();
      expect(el.textContent).toBe('Privy 1');
    });
  });
});
