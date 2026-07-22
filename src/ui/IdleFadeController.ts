export interface IdleFadeControllerOptions {
  target: HTMLElement;
  enabled?: boolean;
  idleOpacity?: number;
  idleDelayMs?: number;
}

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Fades the target element to a configurable opacity after a period of
 * pointer/keyboard inactivity. Returns to full opacity on hover, focus,
 * or whenever a caller invokes `forceActive()` (used to pin full opacity
 * at/under the warning threshold).
 *
 * Respects `prefers-reduced-motion`: the transition is skipped and the
 * opacity change is instant.
 *
 * Emits `data-state="active"` or `data-state="idle"` on the target so
 * CSS rules can hook the state transition if needed.
 */
export class IdleFadeController {
  private target: HTMLElement;
  private enabled: boolean;
  private idleOpacity: number;
  private idleDelayMs: number;
  private idleTimer: number | null = null;
  private forceReasons = new Set<string>();
  private reducedMotion = false;
  private motionQuery: MediaQueryList | null = null;
  private motionListener: ((ev: MediaQueryListEvent) => void) | null = null;
  private attached = false;

  private activityEvents: Array<keyof HTMLElementEventMap> = [
    "mouseenter",
    "mousemove",
    "focusin",
  ];
  private leaveEvents: Array<keyof HTMLElementEventMap> = [
    "mouseleave",
    "focusout",
  ];

  private boundOnActivity: () => void;
  private boundOnLeave: () => void;

  constructor(opts: IdleFadeControllerOptions) {
    this.target = opts.target;
    this.enabled = opts.enabled ?? true;
    this.idleOpacity = opts.idleOpacity ?? 0.7;
    this.idleDelayMs = opts.idleDelayMs ?? 5000;
    this.boundOnActivity = () => this.onActivity();
    this.boundOnLeave = () => this.onLeave();
  }

  /** Start listening and apply initial active state. */
  attach(): void {
    if (this.attached) return;
    this.attached = true;

    this.observeReducedMotion();
    this.applyTransition();
    this.setActive();

    if (!this.enabled) return;

    for (const ev of this.activityEvents) {
      this.target.addEventListener(ev, this.boundOnActivity);
    }
    for (const ev of this.leaveEvents) {
      this.target.addEventListener(ev, this.boundOnLeave);
    }

    this.scheduleIdle();
  }

  /** Stop listening, clear timers, remove forces. Leaves opacity at 1. */
  detach(): void {
    if (!this.attached) return;
    this.attached = false;

    for (const ev of this.activityEvents) {
      this.target.removeEventListener(ev, this.boundOnActivity);
    }
    for (const ev of this.leaveEvents) {
      this.target.removeEventListener(ev, this.boundOnLeave);
    }

    if (this.motionQuery && this.motionListener) {
      this.motionQuery.removeEventListener("change", this.motionListener);
      this.motionQuery = null;
      this.motionListener = null;
    }

    this.clearIdleTimer();
    this.forceReasons.clear();
    this.target.style.opacity = "1";
    this.target.setAttribute("data-state", "active");
  }

  /**
   * Pin the target at full opacity while `reason` is active.
   * Used by the widget to enforce the "never fade at/under warning
   * threshold" invariant, as well as to keep focus visible during
   * session events.
   */
  forceActive(reason: string): void {
    this.forceReasons.add(reason);
    this.clearIdleTimer();
    this.setActive();
  }

  /** Release a previously added force. If no forces remain, resume idle scheduling. */
  releaseForce(reason: string): void {
    this.forceReasons.delete(reason);
    if (this.forceReasons.size === 0 && this.enabled) {
      this.scheduleIdle();
    }
  }

  private onActivity(): void {
    if (this.forceReasons.size > 0) return;
    this.setActive();
    this.scheduleIdle();
  }

  private onLeave(): void {
    if (this.forceReasons.size > 0) return;
    this.scheduleIdle();
  }

  private scheduleIdle(): void {
    this.clearIdleTimer();
    if (!this.enabled || this.forceReasons.size > 0) return;
    this.idleTimer = setTimeout(
      () => this.setIdle(),
      this.idleDelayMs,
    ) as unknown as number;
  }

  private clearIdleTimer(): void {
    if (this.idleTimer !== null) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  private setActive(): void {
    this.target.style.opacity = "1";
    this.target.setAttribute("data-state", "active");
  }

  private setIdle(): void {
    this.target.style.opacity = String(this.idleOpacity);
    this.target.setAttribute("data-state", "idle");
  }

  private applyTransition(): void {
    this.target.style.transition = this.reducedMotion
      ? "none"
      : "opacity 300ms ease";
  }

  private observeReducedMotion(): void {
    if (typeof window === "undefined" || !window.matchMedia) return;
    this.motionQuery = window.matchMedia(REDUCED_MOTION_QUERY);
    this.reducedMotion = this.motionQuery.matches;
    this.motionListener = (ev) => {
      this.reducedMotion = ev.matches;
      this.applyTransition();
    };
    this.motionQuery.addEventListener("change", this.motionListener);
  }
}
