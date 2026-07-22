import { describe, it, expect } from "vitest";
import {
  lightTheme,
  darkTheme,
  getTheme,
  generateCSSVariables,
  generateSessionControlsVars,
  mergeThemeTokens,
  toCssVarString,
} from "../../src/styles/theme";

describe("theme module", () => {
  describe("getTheme", () => {
    it("returns lightTheme when prefersDark is false", () => {
      expect(getTheme(false)).toBe(lightTheme);
    });

    it("returns darkTheme when prefersDark is true", () => {
      expect(getTheme(true)).toBe(darkTheme);
    });

    it("returns a theme when preference is undefined (default light in jsdom)", () => {
      const resolved = getTheme();
      expect(resolved === lightTheme || resolved === darkTheme).toBe(true);
    });
  });

  describe("generateCSSVariables", () => {
    it("emits legacy --gw-* variables for the warning modal", () => {
      const css = generateCSSVariables(lightTheme);
      expect(css).toContain("--gw-background:");
      expect(css).toContain("--gw-primary:");
      expect(css).toContain("--gw-destructive:");
    });
  });

  describe("generateSessionControlsVars", () => {
    it("emits all required --gw-sc-* variables for the light theme", () => {
      const vars = generateSessionControlsVars(lightTheme);
      expect(vars["--gw-sc-bg"]).toBe(lightTheme.colors.card);
      expect(vars["--gw-sc-fg"]).toBe(lightTheme.colors.cardForeground);
      expect(vars["--gw-sc-muted-fg"]).toBe(lightTheme.colors.mutedForeground);
      expect(vars["--gw-sc-border"]).toBe(lightTheme.colors.border);
      expect(vars["--gw-sc-primary"]).toBe(lightTheme.colors.primary);
      expect(vars["--gw-sc-primary-fg"]).toBe(
        lightTheme.colors.primaryForeground,
      );
      expect(vars["--gw-sc-warning"]).toBe(lightTheme.colors.destructive);
      expect(vars["--gw-sc-radius"]).toBe(lightTheme.spacing.borderRadius.lg);
      expect(vars["--gw-sc-shadow"]).toMatch(/rgba\(/);
      expect(vars["--gw-sc-z"]).toBe("2147483000");
      expect(vars["--gw-sc-font"]).toBe(lightTheme.typography.fontFamily);
    });

    it("emits dark theme values when given darkTheme", () => {
      const vars = generateSessionControlsVars(darkTheme);
      expect(vars["--gw-sc-bg"]).toBe(darkTheme.colors.card);
      expect(vars["--gw-sc-primary"]).toBe(darkTheme.colors.primary);
    });

    it("honors extras: borderRadius, shadow, zIndex", () => {
      const vars = generateSessionControlsVars(lightTheme, {
        borderRadius: "14px",
        shadow: "none",
        zIndex: 99,
      });
      expect(vars["--gw-sc-radius"]).toBe("14px");
      expect(vars["--gw-sc-shadow"]).toBe("none");
      expect(vars["--gw-sc-z"]).toBe("99");
    });
  });

  describe("mergeThemeTokens", () => {
    it("returns the base theme unchanged when no overrides", () => {
      expect(mergeThemeTokens(lightTheme)).toBe(lightTheme);
    });

    it("overrides specified color values but preserves others", () => {
      const merged = mergeThemeTokens(lightTheme, {
        colors: { primary: "#FF6B35" },
      });
      expect(merged.colors.primary).toBe("#FF6B35");
      expect(merged.colors.card).toBe(lightTheme.colors.card);
      expect(merged.colors.foreground).toBe(lightTheme.colors.foreground);
    });

    it("preserves spacing and typography when only colors are overridden", () => {
      const merged = mergeThemeTokens(lightTheme, {
        colors: { primary: "#FF6B35" },
      });
      expect(merged.spacing).toBe(lightTheme.spacing);
      expect(merged.typography).toBe(lightTheme.typography);
    });

    it("converts numeric borderRadius to a px string", () => {
      const merged = mergeThemeTokens(lightTheme, { borderRadius: 14 });
      expect(
        (merged as Theme & { borderRadiusOverride?: string })
          .borderRadiusOverride,
      ).toBe("14px");
    });

    it("stores a custom shadow when provided", () => {
      const merged = mergeThemeTokens(lightTheme, { shadow: "none" });
      expect((merged as Theme & { shadow?: string }).shadow).toBe("none");
    });

    it("skips undefined override values without clobbering base colors", () => {
      const merged = mergeThemeTokens(lightTheme, {
        colors: { primary: undefined },
      });
      expect(merged.colors.primary).toBe(lightTheme.colors.primary);
    });
  });

  describe("toCssVarString", () => {
    it("joins a var map into a CSS declaration string", () => {
      const out = toCssVarString({ "--a": "1", "--b": "2" });
      expect(out).toBe("--a: 1; --b: 2;");
    });

    it("round-trips with generateSessionControlsVars", () => {
      const out = toCssVarString(generateSessionControlsVars(lightTheme));
      expect(out).toContain("--gw-sc-bg:");
      expect(out).toContain("--gw-sc-radius:");
    });
  });
});

import type { Theme } from "../../src/styles/theme";
