import type { ThemeMode } from "../types";
import { getTheme, Theme } from "../styles/theme";

export interface DurationSliderOptions {
  /** Minimum allowed minutes */
  min: number;
  /** Maximum allowed minutes */
  max: number;
  /** Current/initial value in minutes */
  value: number;
  /** Step increment in minutes (default: 15) */
  step?: number;
  /** Callback when value changes */
  onChange: (minutes: number) => void;
}

/**
 * Duration Slider component for selecting extension duration.
 * DOM-based component (no React dependency) for maximum compatibility.
 */
export class DurationSlider {
  private container: HTMLDivElement | null = null;
  private theme: Theme;
  private options: DurationSliderOptions | null = null;

  constructor(themeMode: ThemeMode = "light") {
    const prefersDark =
      themeMode === "dark" || (themeMode === "auto" && this.detectDarkMode());
    this.theme = getTheme(prefersDark);
  }

  private detectDarkMode(): boolean {
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return false;
  }

  /**
   * Format minutes into a human-readable duration string.
   */
  private formatDuration(minutes: number): string {
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) {
      return hours === 1 ? "1 hour" : `${hours} hours`;
    }
    return `${hours}h ${mins}m`;
  }

  /**
   * Render the slider into a container element.
   */
  render(parent: HTMLElement, options: DurationSliderOptions): void {
    this.options = options;
    const step = options.step ?? 15;

    // Create container
    this.container = document.createElement("div");
    this.container.setAttribute("data-testid", "gw-duration-slider");
    this.container.style.cssText = `
      width: 100%;
      margin: ${this.theme.spacing.padding.md} 0;
    `;

    // Create label row with current value
    const labelRow = document.createElement("div");
    labelRow.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: ${this.theme.spacing.padding.sm};
      font-size: ${this.theme.typography.fontSize.sm};
      color: ${this.theme.colors.mutedForeground};
    `;

    const label = document.createElement("span");
    label.textContent = "Extension Duration";

    const valueDisplay = document.createElement("span");
    valueDisplay.setAttribute("data-testid", "gw-duration-value");
    valueDisplay.style.cssText = `
      font-weight: ${this.theme.typography.fontWeight.semibold};
      color: ${this.theme.colors.foreground};
    `;
    valueDisplay.textContent = this.formatDuration(options.value);

    labelRow.appendChild(label);
    labelRow.appendChild(valueDisplay);

    // Create slider input
    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = String(options.min);
    slider.max = String(options.max);
    slider.step = String(step);
    slider.value = String(options.value);
    slider.setAttribute("data-testid", "gw-duration-slider-input");
    slider.setAttribute("aria-label", "Extension duration in minutes");
    slider.style.cssText = `
      width: 100%;
      height: 8px;
      -webkit-appearance: none;
      appearance: none;
      background: ${this.theme.colors.muted};
      border-radius: ${this.theme.spacing.borderRadius.sm};
      outline: none;
      cursor: pointer;
    `;

    // Style the thumb via a stylesheet injection
    this.injectSliderStyles();

    // Create min/max labels
    const rangeLabels = document.createElement("div");
    rangeLabels.style.cssText = `
      display: flex;
      justify-content: space-between;
      margin-top: ${this.theme.spacing.padding.sm};
      font-size: ${this.theme.typography.fontSize.xs};
      color: ${this.theme.colors.mutedForeground};
    `;

    const minLabel = document.createElement("span");
    minLabel.textContent = this.formatDuration(options.min);

    const maxLabel = document.createElement("span");
    maxLabel.textContent = this.formatDuration(options.max);

    rangeLabels.appendChild(minLabel);
    rangeLabels.appendChild(maxLabel);

    // Handle slider changes
    slider.addEventListener("input", (e) => {
      const target = e.target as HTMLInputElement;
      const newValue = parseInt(target.value, 10);
      valueDisplay.textContent = this.formatDuration(newValue);
      options.onChange(newValue);
    });

    // Assemble the component
    this.container.appendChild(labelRow);
    this.container.appendChild(slider);
    this.container.appendChild(rangeLabels);

    parent.appendChild(this.container);
  }

  /**
   * Inject CSS for slider thumb styling (cross-browser).
   */
  private injectSliderStyles(): void {
    const styleId = "gw-duration-slider-styles";
    if (document.getElementById(styleId)) {
      return; // Already injected
    }

    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      [data-testid="gw-duration-slider-input"]::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 20px;
        height: 20px;
        background: ${this.theme.colors.primary};
        border-radius: 50%;
        cursor: pointer;
        border: 2px solid ${this.theme.colors.background};
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      }
      [data-testid="gw-duration-slider-input"]::-moz-range-thumb {
        width: 20px;
        height: 20px;
        background: ${this.theme.colors.primary};
        border-radius: 50%;
        cursor: pointer;
        border: 2px solid ${this.theme.colors.background};
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      }
      [data-testid="gw-duration-slider-input"]:focus::-webkit-slider-thumb {
        box-shadow: 0 0 0 3px ${this.theme.colors.ring}40;
      }
      [data-testid="gw-duration-slider-input"]:focus::-moz-range-thumb {
        box-shadow: 0 0 0 3px ${this.theme.colors.ring}40;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Update the slider value programmatically.
   */
  updateValue(minutes: number): void {
    if (!this.container) return;

    const slider = this.container.querySelector(
      '[data-testid="gw-duration-slider-input"]',
    ) as HTMLInputElement | null;
    const valueDisplay = this.container.querySelector(
      '[data-testid="gw-duration-value"]',
    ) as HTMLSpanElement | null;

    if (slider) {
      slider.value = String(minutes);
    }
    if (valueDisplay) {
      valueDisplay.textContent = this.formatDuration(minutes);
    }
  }

  /**
   * Get the current slider value.
   */
  getValue(): number {
    if (!this.container) return this.options?.value ?? 0;

    const slider = this.container.querySelector(
      '[data-testid="gw-duration-slider-input"]',
    ) as HTMLInputElement | null;

    return slider ? parseInt(slider.value, 10) : (this.options?.value ?? 0);
  }

  /**
   * Remove the slider from the DOM.
   */
  destroy(): void {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
      this.container = null;
    }
  }
}
