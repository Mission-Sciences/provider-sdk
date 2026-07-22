import type { Position } from "../types";

const NARROW_BREAKPOINT = "(max-width: 480px)";

export interface FloatingContainerOptions {
  position: Position;
  offset?: { x?: number; y?: number };
  zIndex?: number;
}

/**
 * Viewport-fixed wrapper for the floating session-controls widget.
 *
 * Handles six-way positioning (`{top|bottom}-{left|center|right}`), pixel
 * offsets from the configured edge, and narrow-viewport collapse to a
 * fullwidth edge bar that honors the configured vertical edge (top vs
 * bottom). Narrow-viewport horizontal component is ignored — all six
 * positions collapse to a full-width bar on the chosen top/bottom edge,
 * so a publisher app with a bottom navigation can set `position: 'top-*'`
 * to keep the bottom edge clear.
 *
 * Pure DOM, no framework dependency.
 */
export class FloatingContainer {
  private root: HTMLElement;
  private position: Position;
  private offset: { x: number; y: number };
  private zIndex: number;
  private mediaQuery: MediaQueryList | null = null;
  private mediaListener: ((ev: MediaQueryListEvent) => void) | null = null;
  private narrow = false;

  constructor(opts: FloatingContainerOptions) {
    this.position = opts.position;
    this.offset = { x: opts.offset?.x ?? 16, y: opts.offset?.y ?? 16 };
    this.zIndex = opts.zIndex ?? 2147483000;

    this.root = document.createElement("div");
    this.root.className = "gw-session-controls gw-session-controls--floating";
    this.root.setAttribute("role", "region");
    this.root.setAttribute("aria-label", "Session controls");
    this.root.style.position = "fixed";
    this.root.style.zIndex = String(this.zIndex);
    this.root.style.pointerEvents = "auto";

    this.applyNarrowState(this.matchesNarrow());
    this.observeViewport();
  }

  /** The element to mount into the DOM. */
  get element(): HTMLElement {
    return this.root;
  }

  /** Attach a child into the floating root. */
  attach(child: HTMLElement): void {
    this.root.appendChild(child);
  }

  /** Append the container to document.body. */
  mount(): void {
    if (!this.root.isConnected) {
      document.body.appendChild(this.root);
    }
  }

  /** Update position and/or offset at runtime. */
  updatePosition(
    position: Position,
    offset?: { x?: number; y?: number },
  ): void {
    this.position = position;
    if (offset) {
      this.offset = {
        x: offset.x ?? this.offset.x,
        y: offset.y ?? this.offset.y,
      };
    }
    this.applyPositionStyles();
  }

  /** Remove from DOM and drop listeners. */
  detach(): void {
    if (this.mediaQuery && this.mediaListener) {
      this.mediaQuery.removeEventListener("change", this.mediaListener);
      this.mediaQuery = null;
      this.mediaListener = null;
    }
    if (this.root.parentNode) {
      this.root.parentNode.removeChild(this.root);
    }
  }

  private matchesNarrow(): boolean {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia(NARROW_BREAKPOINT).matches;
  }

  private observeViewport(): void {
    if (typeof window === "undefined" || !window.matchMedia) return;
    this.mediaQuery = window.matchMedia(NARROW_BREAKPOINT);
    this.mediaListener = (ev) => {
      this.applyNarrowState(ev.matches);
    };
    this.mediaQuery.addEventListener("change", this.mediaListener);
  }

  private applyNarrowState(narrow: boolean): void {
    this.narrow = narrow;
    if (narrow) {
      this.root.classList.add("gw-session-controls--narrow");
    } else {
      this.root.classList.remove("gw-session-controls--narrow");
    }
    this.applyPositionStyles();
  }

  private applyPositionStyles(): void {
    const style = this.root.style;
    style.top = "";
    style.bottom = "";
    style.left = "";
    style.right = "";
    style.transform = "";
    style.width = "";

    const isTop = this.position.startsWith("top-");
    const isBottom = this.position.startsWith("bottom-");
    const isLeft = this.position.endsWith("-left");
    const isRight = this.position.endsWith("-right");
    const isCenter = this.position.endsWith("-center");

    if (this.narrow) {
      // Fullwidth edge bar — ignore horizontal component.
      style.left = "0";
      style.right = "0";
      style.width = "100%";
      if (isTop) {
        style.top = "0";
      } else if (isBottom) {
        style.bottom = "0";
      }
      return;
    }

    if (isTop) style.top = `${this.offset.y}px`;
    if (isBottom) style.bottom = `${this.offset.y}px`;
    if (isLeft) style.left = `${this.offset.x}px`;
    if (isRight) style.right = `${this.offset.x}px`;
    if (isCenter) {
      style.left = "50%";
      style.transform = "translateX(-50%)";
    }
  }
}
