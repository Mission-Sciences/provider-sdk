/**
 * Theme configuration matching the General Wisdom SPA design system
 * Based on gw-spa/src/styles/globals.css and Tailwind CSS v4
 */

export interface ThemeColors {
  // Background colors
  background: string;
  foreground: string;

  // Card colors
  card: string;
  cardForeground: string;

  // Popover colors
  popover: string;
  popoverForeground: string;

  // Primary colors (brand blue)
  primary: string;
  primaryForeground: string;

  // Secondary colors (light gray)
  secondary: string;
  secondaryForeground: string;

  // Muted colors
  muted: string;
  mutedForeground: string;

  // Accent colors
  accent: string;
  accentForeground: string;

  // Destructive colors (red for errors/warnings)
  destructive: string;
  destructiveForeground: string;

  // Success colors (green for success actions)
  success: string;
  successForeground: string;

  // Border and input
  border: string;
  input: string;
  ring: string;
}

export interface ThemeTypography {
  fontFamily: string;
  fontSize: {
    xs: string;
    sm: string;
    base: string;
    lg: string;
    xl: string;
    "2xl": string;
  };
  fontWeight: {
    normal: string;
    medium: string;
    semibold: string;
    bold: string;
  };
  lineHeight: {
    tight: string;
    normal: string;
    relaxed: string;
  };
}

export interface ThemeSpacing {
  borderRadius: {
    sm: string;
    md: string;
    lg: string;
  };
  padding: {
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  gap: {
    sm: string;
    md: string;
    lg: string;
  };
}

export interface Theme {
  colors: ThemeColors;
  typography: ThemeTypography;
  spacing: ThemeSpacing;
}

/**
 * Light theme matching gw-spa design system
 */
export const lightTheme: Theme = {
  colors: {
    // Background
    background: "hsl(0 0% 100%)",
    foreground: "hsl(222.2 84% 4.9%)",

    // Card
    card: "hsl(0 0% 100%)",
    cardForeground: "hsl(222.2 84% 4.9%)",

    // Popover
    popover: "hsl(0 0% 100%)",
    popoverForeground: "hsl(222.2 84% 4.9%)",

    // Primary (brand blue)
    primary: "hsl(221.2 83.2% 53.3%)",
    primaryForeground: "hsl(210 40% 98%)",

    // Secondary (light gray)
    secondary: "hsl(210 40% 96.1%)",
    secondaryForeground: "hsl(222.2 47.4% 11.2%)",

    // Muted
    muted: "hsl(210 40% 96.1%)",
    mutedForeground: "hsl(215.4 16.3% 46.9%)",

    // Accent
    accent: "hsl(210 40% 96.1%)",
    accentForeground: "hsl(222.2 47.4% 11.2%)",

    // Destructive (red)
    destructive: "hsl(0 84.2% 60.2%)",
    destructiveForeground: "hsl(210 40% 98%)",

    // Success (green)
    success: "hsl(142 76% 36%)", // Tailwind green-600 equivalent
    successForeground: "hsl(0 0% 100%)",

    // Border and input
    border: "hsl(214.3 31.8% 91.4%)",
    input: "hsl(214.3 31.8% 91.4%)",
    ring: "hsl(221.2 83.2% 53.3%)",
  },
  typography: {
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    fontSize: {
      xs: "12px",
      sm: "14px",
      base: "16px",
      lg: "18px",
      xl: "20px",
      "2xl": "24px",
    },
    fontWeight: {
      normal: "400",
      medium: "500",
      semibold: "600",
      bold: "700",
    },
    lineHeight: {
      tight: "1.25",
      normal: "1.5",
      relaxed: "1.75",
    },
  },
  spacing: {
    borderRadius: {
      sm: "4px", // calc(0.5rem - 4px)
      md: "6px", // calc(0.5rem - 2px)
      lg: "8px", // 0.5rem
    },
    padding: {
      sm: "8px",
      md: "16px",
      lg: "24px",
      xl: "32px",
    },
    gap: {
      sm: "8px",
      md: "12px",
      lg: "16px",
    },
  },
};

/**
 * Dark theme matching gw-spa design system
 */
export const darkTheme: Theme = {
  colors: {
    // Background
    background: "hsl(222.2 84% 4.9%)",
    foreground: "hsl(210 40% 98%)",

    // Card
    card: "hsl(222.2 84% 4.9%)",
    cardForeground: "hsl(210 40% 98%)",

    // Popover
    popover: "hsl(222.2 84% 4.9%)",
    popoverForeground: "hsl(210 40% 98%)",

    // Primary (lighter blue for dark mode)
    primary: "hsl(217.2 91.2% 59.8%)",
    primaryForeground: "hsl(222.2 47.4% 11.2%)",

    // Secondary (dark gray)
    secondary: "hsl(217.2 32.6% 17.5%)",
    secondaryForeground: "hsl(210 40% 98%)",

    // Muted
    muted: "hsl(217.2 32.6% 17.5%)",
    mutedForeground: "hsl(215 20.2% 65.1%)",

    // Accent
    accent: "hsl(217.2 32.6% 17.5%)",
    accentForeground: "hsl(210 40% 98%)",

    // Destructive (darker red for dark mode)
    destructive: "hsl(0 62.8% 30.6%)",
    destructiveForeground: "hsl(210 40% 98%)",

    // Success (darker green for dark mode)
    success: "hsl(142 71% 45%)", // Tailwind green-500 equivalent
    successForeground: "hsl(0 0% 100%)",

    // Border and input
    border: "hsl(217.2 32.6% 17.5%)",
    input: "hsl(217.2 32.6% 17.5%)",
    ring: "hsl(224.3 76.3% 48%)",
  },
  typography: {
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    fontSize: {
      xs: "12px",
      sm: "14px",
      base: "16px",
      lg: "18px",
      xl: "20px",
      "2xl": "24px",
    },
    fontWeight: {
      normal: "400",
      medium: "500",
      semibold: "600",
      bold: "700",
    },
    lineHeight: {
      tight: "1.25",
      normal: "1.5",
      relaxed: "1.75",
    },
  },
  spacing: {
    borderRadius: {
      sm: "4px",
      md: "6px",
      lg: "8px",
    },
    padding: {
      sm: "8px",
      md: "16px",
      lg: "24px",
      xl: "32px",
    },
    gap: {
      sm: "8px",
      md: "12px",
      lg: "16px",
    },
  },
};

/**
 * Get theme based on user preference or system setting
 */
export function getTheme(prefersDark?: boolean): Theme {
  // Check for explicit preference
  if (prefersDark !== undefined) {
    return prefersDark ? darkTheme : lightTheme;
  }

  // Check system preference
  if (typeof window !== "undefined" && window.matchMedia) {
    const isDarkMode = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    return isDarkMode ? darkTheme : lightTheme;
  }

  // Default to light theme
  return lightTheme;
}

/**
 * Generate CSS string from theme colors for inline styles
 */
export function generateCSSVariables(theme: Theme): string {
  return `
    --gw-background: ${theme.colors.background};
    --gw-foreground: ${theme.colors.foreground};
    --gw-card: ${theme.colors.card};
    --gw-card-foreground: ${theme.colors.cardForeground};
    --gw-primary: ${theme.colors.primary};
    --gw-primary-foreground: ${theme.colors.primaryForeground};
    --gw-secondary: ${theme.colors.secondary};
    --gw-secondary-foreground: ${theme.colors.secondaryForeground};
    --gw-muted: ${theme.colors.muted};
    --gw-muted-foreground: ${theme.colors.mutedForeground};
    --gw-accent: ${theme.colors.accent};
    --gw-accent-foreground: ${theme.colors.accentForeground};
    --gw-destructive: ${theme.colors.destructive};
    --gw-destructive-foreground: ${theme.colors.destructiveForeground};
    --gw-success: ${theme.colors.success};
    --gw-success-foreground: ${theme.colors.successForeground};
    --gw-border: ${theme.colors.border};
    --gw-input: ${theme.colors.input};
    --gw-ring: ${theme.colors.ring};
  `.trim();
}

/**
 * Merge a partial theme-token override onto a resolved base theme.
 * Used by SessionControlsConfig.theme to let developers override specific
 * colors or layout values without replacing the whole theme.
 *
 * Only fields present in the overrides object are applied; undefined fields
 * in nested objects are skipped so consumers may pass `{ colors: { primary } }`
 * and preserve every other color.
 */
export function mergeThemeTokens(
  base: Theme,
  overrides?: {
    colors?: Partial<Theme["colors"]>;
    borderRadius?: string | number;
    shadow?: string;
  },
): Theme & { shadow?: string; borderRadiusOverride?: string } {
  if (!overrides) return base;

  const mergedColors = overrides.colors
    ? ({ ...base.colors } as Theme["colors"])
    : base.colors;

  if (overrides.colors) {
    for (const [key, value] of Object.entries(overrides.colors)) {
      if (value !== undefined) {
        (mergedColors as unknown as Record<string, string>)[key] = value;
      }
    }
  }

  const borderRadiusOverride =
    overrides.borderRadius !== undefined
      ? typeof overrides.borderRadius === "number"
        ? `${overrides.borderRadius}px`
        : overrides.borderRadius
      : undefined;

  return {
    ...base,
    colors: mergedColors,
    ...(borderRadiusOverride ? { borderRadiusOverride } : {}),
    ...(overrides.shadow ? { shadow: overrides.shadow } : {}),
  };
}

/**
 * Emit the session-controls CSS custom properties.
 *
 * The widget reads every visual value from `--gw-sc-*` variables so host
 * stylesheets can override any value via the cascade without requiring a
 * JavaScript config change.
 *
 * Returns a map of variable names to values. Callers spread the result into
 * inline styles or build a CSS string via `toCssVarString()`.
 */
export function generateSessionControlsVars(
  theme: Theme,
  extras?: { borderRadius?: string; shadow?: string; zIndex?: number },
): Record<string, string> {
  const radius = extras?.borderRadius ?? theme.spacing.borderRadius.lg;
  const shadow =
    extras?.shadow ??
    "0 8px 24px rgba(17,24,39,0.08), 0 2px 6px rgba(17,24,39,0.04)";
  const zIndex = extras?.zIndex ?? 2147483000;

  return {
    "--gw-sc-bg": theme.colors.card,
    "--gw-sc-fg": theme.colors.cardForeground,
    "--gw-sc-muted-fg": theme.colors.mutedForeground,
    "--gw-sc-border": theme.colors.border,
    "--gw-sc-primary": theme.colors.primary,
    "--gw-sc-primary-fg": theme.colors.primaryForeground,
    "--gw-sc-warning": theme.colors.destructive,
    "--gw-sc-radius": radius,
    "--gw-sc-shadow": shadow,
    "--gw-sc-z": String(zIndex),
    "--gw-sc-font": theme.typography.fontFamily,
    "--gw-sc-font-size": theme.typography.fontSize.sm,
    "--gw-sc-gap": theme.spacing.gap.md,
    "--gw-sc-padding-y": theme.spacing.padding.sm,
    "--gw-sc-padding-x": theme.spacing.padding.md,
  };
}

/**
 * Convert a var map from `generateSessionControlsVars` into a CSS declaration string.
 */
export function toCssVarString(vars: Record<string, string>): string {
  return Object.entries(vars)
    .map(([name, value]) => `${name}: ${value};`)
    .join(" ");
}
