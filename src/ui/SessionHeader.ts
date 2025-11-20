import { ThemeMode } from '../types';
import { getTheme, Theme } from '../styles/theme';

/**
 * Session Header Component
 * Compact header widget showing session timer with extend/end controls
 */
export class SessionHeader {
  private container: HTMLDivElement | null = null;
  private theme: Theme;
  private updateInterval: number | null = null;
  private timeDisplay: HTMLElement | null = null;
  private getTimeCallback: (() => string) | undefined;
  private onExtendCallback: (() => void) | undefined;
  private onEndCallback: (() => void) | undefined;
  private mounted: boolean = false;

  constructor(themeMode: ThemeMode = 'auto') {
    const prefersDark = themeMode === 'dark' || (themeMode === 'auto' && this.detectDarkMode());
    this.theme = getTheme(prefersDark);
  }

  private detectDarkMode(): boolean {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  }

  /**
   * Mount the session header to a DOM element
   * @param targetElement - Element to mount to (or selector string)
   * @param options - Configuration options
   */
  mount(
    targetElement: HTMLElement | string,
    options: {
      getTime: () => string;
      onExtend?: () => void;
      onEnd?: () => void;
      position?: 'left' | 'center' | 'right';
    }
  ): void {
    // Unmount if already mounted
    if (this.mounted) {
      this.unmount();
    }

    // Get target element
    const target =
      typeof targetElement === 'string'
        ? document.querySelector<HTMLElement>(targetElement)
        : targetElement;

    if (!target) {
      console.error('[SessionHeader] Mount target not found');
      return;
    }

    this.getTimeCallback = options.getTime;
    this.onExtendCallback = options.onExtend;
    this.onEndCallback = options.onEnd;

    // Create container
    this.container = document.createElement('div');
    this.container.id = 'gw-session-header';

    const position = options.position || 'right';
    const justifyContent =
      position === 'left' ? 'flex-start' :
      position === 'center' ? 'center' :
      'flex-end';

    this.container.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: ${justifyContent};
      gap: ${this.theme.spacing.gap.md};
      padding: ${this.theme.spacing.padding.sm} ${this.theme.spacing.padding.md};
      background-color: ${this.theme.colors.card};
      border: 1px solid ${this.theme.colors.border};
      border-radius: ${this.theme.spacing.borderRadius.md};
      font-family: ${this.theme.typography.fontFamily};
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    `;

    // Create timer display
    const timerWrapper = document.createElement('div');
    timerWrapper.style.cssText = `
      display: flex;
      align-items: center;
      gap: ${this.theme.spacing.gap.sm};
      color: ${this.theme.colors.foreground};
      font-size: ${this.theme.typography.fontSize.sm};
      font-weight: ${this.theme.typography.fontWeight.medium};
    `;

    const clockIcon = document.createElement('span');
    clockIcon.textContent = '⏱️';
    clockIcon.style.fontSize = this.theme.typography.fontSize.base;

    this.timeDisplay = document.createElement('span');
    this.timeDisplay.id = 'gw-session-time';
    this.timeDisplay.textContent = this.getTimeCallback?.() || '--:--';
    this.timeDisplay.style.cssText = `
      font-variant-numeric: tabular-nums;
      min-width: 50px;
      text-align: center;
    `;

    timerWrapper.appendChild(clockIcon);
    timerWrapper.appendChild(this.timeDisplay);
    this.container.appendChild(timerWrapper);

    // Create button container
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
      display: flex;
      gap: ${this.theme.spacing.gap.sm};
    `;

    // Extend button (if callback provided)
    if (this.onExtendCallback) {
      const extendBtn = document.createElement('button');
      extendBtn.textContent = 'Extend';
      extendBtn.style.cssText = `
        padding: ${this.theme.spacing.padding.sm};
        background-color: ${this.theme.colors.success};
        color: ${this.theme.colors.successForeground};
        border: none;
        border-radius: ${this.theme.spacing.borderRadius.sm};
        font-size: ${this.theme.typography.fontSize.sm};
        font-weight: ${this.theme.typography.fontWeight.medium};
        font-family: ${this.theme.typography.fontFamily};
        cursor: pointer;
        transition: opacity 0.2s;
      `;
      extendBtn.addEventListener('mouseenter', () => {
        extendBtn.style.opacity = '0.9';
      });
      extendBtn.addEventListener('mouseleave', () => {
        extendBtn.style.opacity = '1';
      });
      extendBtn.addEventListener('click', () => {
        this.onExtendCallback?.();
      });
      buttonContainer.appendChild(extendBtn);
    }

    // End button (if callback provided)
    if (this.onEndCallback) {
      const endBtn = document.createElement('button');
      endBtn.textContent = 'End';
      endBtn.style.cssText = `
        padding: ${this.theme.spacing.padding.sm};
        background-color: ${this.theme.colors.secondary};
        color: ${this.theme.colors.secondaryForeground};
        border: 1px solid ${this.theme.colors.border};
        border-radius: ${this.theme.spacing.borderRadius.sm};
        font-size: ${this.theme.typography.fontSize.sm};
        font-weight: ${this.theme.typography.fontWeight.medium};
        font-family: ${this.theme.typography.fontFamily};
        cursor: pointer;
        transition: opacity 0.2s;
      `;
      endBtn.addEventListener('mouseenter', () => {
        endBtn.style.opacity = '0.9';
      });
      endBtn.addEventListener('mouseleave', () => {
        endBtn.style.opacity = '1';
      });
      endBtn.addEventListener('click', () => {
        this.onEndCallback?.();
      });
      buttonContainer.appendChild(endBtn);
    }

    if (buttonContainer.children.length > 0) {
      this.container.appendChild(buttonContainer);
    }

    // Mount to target
    target.appendChild(this.container);
    this.mounted = true;

    // Start updating time display
    this.startUpdating();
  }

  /**
   * Start updating the time display
   */
  private startUpdating(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    this.updateInterval = window.setInterval(() => {
      if (this.timeDisplay && this.getTimeCallback) {
        const newTime = this.getTimeCallback();
        this.timeDisplay.textContent = newTime;

        // Change color if warning state (< 5 minutes = MM:SS where MM < 05)
        const [minutes] = newTime.split(':').map(Number);
        if (!isNaN(minutes) && minutes < 5) {
          this.timeDisplay.style.color = this.theme.colors.destructive;
          this.timeDisplay.style.fontWeight = this.theme.typography.fontWeight.bold;
        } else {
          this.timeDisplay.style.color = this.theme.colors.foreground;
          this.timeDisplay.style.fontWeight = this.theme.typography.fontWeight.medium;
        }
      }
    }, 1000);
  }

  /**
   * Unmount and cleanup the session header
   */
  unmount(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }

    this.container = null;
    this.timeDisplay = null;
    this.mounted = false;
  }

  /**
   * Check if component is mounted
   */
  isMounted(): boolean {
    return this.mounted;
  }

  /**
   * Update the theme
   */
  updateTheme(themeMode: ThemeMode): void {
    const prefersDark = themeMode === 'dark' || (themeMode === 'auto' && this.detectDarkMode());
    this.theme = getTheme(prefersDark);

    // Re-mount with new theme if currently mounted
    if (this.mounted && this.container && this.container.parentElement) {
      const parent = this.container.parentElement;
      const options = {
        getTime: this.getTimeCallback!,
        onExtend: this.onExtendCallback,
        onEnd: this.onEndCallback,
      };
      this.unmount();
      this.mount(parent, options);
    }
  }
}
