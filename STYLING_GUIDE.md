# SDK Styling Guide

## Overview

The General Wisdom Provider SDK now uses a comprehensive design system that matches the General Wisdom SPA (Single Page Application) styling. This ensures visual consistency across all components and provides a professional, cohesive user experience.

## Design System Match

The SDK styling is based on the **gw-spa** design system, which uses:
- **Tailwind CSS v4** color palette
- **shadcn/ui** component patterns
- **HSL color format** for better color manipulation
- **CSS custom properties** for theming
- **System font stack** for optimal cross-platform typography

## Theme System

### Available Themes

The SDK provides three theme modes:

1. **`light`** (default): Bright, clean interface with high contrast
2. **`dark`**: Dark mode with reduced eye strain for low-light environments
3. **`auto`**: Automatically detects system preference using `prefers-color-scheme`

### Color Palette

#### Light Theme Colors

```typescript
// Primary brand color (Blue)
primary: hsl(221.2 83.2% 53.3%)
primaryForeground: hsl(210 40% 98%)

// Destructive (Red for warnings/errors)
destructive: hsl(0 84.2% 60.2%)
destructiveForeground: hsl(210 40% 98%)

// Success (Green for positive actions)
success: hsl(142 76% 36%)
successForeground: hsl(0 0% 100%)

// Background & Cards
background: hsl(0 0% 100%)
foreground: hsl(222.2 84% 4.9%)
card: hsl(0 0% 100%)
cardForeground: hsl(222.2 84% 4.9%)

// Secondary (Light gray)
secondary: hsl(210 40% 96.1%)
secondaryForeground: hsl(222.2 47.4% 11.2%)

// Muted (Subtle text)
muted: hsl(210 40% 96.1%)
mutedForeground: hsl(215.4 16.3% 46.9%)

// Borders & Inputs
border: hsl(214.3 31.8% 91.4%)
input: hsl(214.3 31.8% 91.4%)
ring: hsl(221.2 83.2% 53.3%)
```

#### Dark Theme Colors

```typescript
// Primary brand color (Lighter blue for dark mode)
primary: hsl(217.2 91.2% 59.8%)
primaryForeground: hsl(222.2 47.4% 11.2%)

// Destructive (Darker red for dark mode)
destructive: hsl(0 62.8% 30.6%)
destructiveForeground: hsl(210 40% 98%)

// Success (Darker green for dark mode)
success: hsl(142 71% 45%)
successForeground: hsl(0 0% 100%)

// Background & Cards (Dark)
background: hsl(222.2 84% 4.9%)
foreground: hsl(210 40% 98%)
card: hsl(222.2 84% 4.9%)
cardForeground: hsl(210 40% 98%)

// Secondary (Dark gray)
secondary: hsl(217.2 32.6% 17.5%)
secondaryForeground: hsl(210 40% 98%)

// Muted (Subtle text for dark mode)
muted: hsl(217.2 32.6% 17.5%)
mutedForeground: hsl(215 20.2% 65.1%)

// Borders & Inputs (Dark)
border: hsl(217.2 32.6% 17.5%)
input: hsl(217.2 32.6% 17.5%)
ring: hsl(224.3 76.3% 48%)
```

### Typography

The SDK uses a **system font stack** for optimal rendering across all platforms:

```css
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif
```

**Font Sizes:**
- `xs`: 12px - Small labels, helper text
- `sm`: 14px - Buttons, form elements
- `base`: 16px - Body text, descriptions
- `lg`: 18px - Subheadings
- `xl`: 20px - Modal titles
- `2xl`: 24px - Large headings

**Font Weights:**
- `normal`: 400 - Body text
- `medium`: 500 - Button labels, form labels
- `semibold`: 600 - Headings, emphasis
- `bold`: 700 - Strong emphasis

**Line Heights:**
- `tight`: 1.25 - Headings
- `normal`: 1.5 - Body text (default)
- `relaxed`: 1.75 - Long-form content

### Spacing

**Border Radius:**
- `sm`: 4px - Small elements like tags
- `md`: 6px - Buttons, inputs
- `lg`: 8px - Cards, modals

**Padding:**
- `sm`: 8px - Compact spacing
- `md`: 16px - Standard spacing
- `lg`: 24px - Generous spacing
- `xl`: 32px - Large containers

**Gap (between elements):**
- `sm`: 8px - Tight grouping
- `md`: 12px - Standard gap (default)
- `lg`: 16px - Loose grouping

## Using the Theme System

### Basic Configuration

```typescript
import { MarketplaceSDK } from '@marketplace/provider-sdk';

// Light mode (default)
const sdk = new MarketplaceSDK({
  themeMode: 'light',
  // ... other config
});

// Dark mode
const sdk = new MarketplaceSDK({
  themeMode: 'dark',
  // ... other config
});

// Auto-detect system preference
const sdk = new MarketplaceSDK({
  themeMode: 'auto',
  // ... other config
});
```

### Advanced: Custom Theme Usage

You can import and use theme utilities directly:

```typescript
import { getTheme, lightTheme, darkTheme, Theme } from '@marketplace/provider-sdk';

// Get theme based on user preference
const theme: Theme = getTheme(true); // true for dark mode

// Access theme colors
console.log(theme.colors.primary); // hsl(217.2 91.2% 59.8%)

// Access typography
console.log(theme.typography.fontSize.lg); // 18px

// Access spacing
console.log(theme.spacing.borderRadius.lg); // 8px
```

### Legacy: Custom Styles (Backward Compatible)

For backward compatibility, you can still use the legacy `customStyles` option:

```typescript
const sdk = new MarketplaceSDK({
  customStyles: {
    backgroundColor: '#ffffff',
    textColor: '#333333',
    primaryColor: '#007bff',
    borderRadius: '8px',
    fontFamily: 'Arial, sans-serif',
  },
  // ... other config
});
```

**Note:** Using `customStyles` will override the theme system. It's recommended to use `themeMode` for consistency with the SPA design.

## Modal Styling

### Warning Modal

The warning modal uses the theme system for all visual elements:

**Light Mode Appearance:**
- White background with subtle border
- Blue primary button for "Extend Session"
- Red destructive button for "End Session"
- Gray outline button for "Continue"
- Focus rings for accessibility

**Dark Mode Appearance:**
- Dark background with subtle border
- Lighter blue primary button
- Darker red destructive button
- Gray outline button with adjusted contrast
- Focus rings matching the theme

### Session Ending Modal

The session ending modal displays when a session expires:

**Features:**
- Large emoji icon (⏱️)
- Prominent destructive color for urgency
- Animated progress bar showing countdown
- Smooth fade-in and slide-in animations
- Gradient progress bar (destructive → primary colors)

## Component Styling Details

### Buttons

All buttons follow the **shadcn/ui** button patterns:

**Variants:**
1. **Primary (Success)**: Green background, used for "Extend Session"
   - Light: `hsl(142 76% 36%)`
   - Dark: `hsl(142 71% 45%)`

2. **Destructive**: Red background, used for "End Session"
   - Light: `hsl(0 84.2% 60.2%)`
   - Dark: `hsl(0 62.8% 30.6%)`

3. **Outline**: Transparent background with border, used for "Continue"
   - Border color matches theme border
   - Text color matches theme foreground

**Button Interactions:**
- `hover`: 90% opacity
- `focus`: 2px ring with offset
- `transition`: All properties 0.2s

### Typography in Modals

**Modal Title:**
- Font size: `xl` (20px) for warnings, `2xl` (24px) for ending message
- Font weight: `semibold` (600)
- Color: Foreground for warnings, destructive for ending message

**Modal Body:**
- Font size: `base` (16px)
- Line height: `normal` (1.5)
- Color: `mutedForeground` for better readability

**Timer Display:**
- Font weight: `bold`
- Color: Foreground (high contrast)

## Accessibility Features

The theme system includes several accessibility enhancements:

1. **Focus Rings**: 2px solid rings with offset for keyboard navigation
2. **Color Contrast**: WCAG AA compliant color combinations
3. **System Font Stack**: Optimized for readability across platforms
4. **Hover States**: Clear visual feedback with opacity changes
5. **Dark Mode**: Reduced eye strain in low-light environments

## Migration from Old Styling

### Before (Hardcoded Colors)

```typescript
const sdk = new MarketplaceSDK({
  customStyles: {
    backgroundColor: '#ffffff',
    textColor: '#333333',
    primaryColor: '#007bff',
    borderRadius: '8px',
  },
});
```

### After (Theme System)

```typescript
const sdk = new MarketplaceSDK({
  themeMode: 'light', // or 'dark' or 'auto'
});
```

**Benefits:**
- Automatic color coordination
- Dark mode support
- Consistent with SPA design
- Better accessibility
- Easier maintenance

## Comparison: SDK vs SPA

| Feature | SDK (Before) | SDK (After) | SPA |
|---------|--------------|-------------|-----|
| Primary Color | `#007bff` | `hsl(221.2 83.2% 53.3%)` | `hsl(221.2 83.2% 53.3%)` ✅ |
| Destructive | `#ef4444` | `hsl(0 84.2% 60.2%)` | `hsl(0 84.2% 60.2%)` ✅ |
| Success | `#10b981` | `hsl(142 76% 36%)` | Similar green ✅ |
| Border Radius | `8px` | `8px` | `8px` (0.5rem) ✅ |
| Font Stack | Basic | System font stack | System font stack ✅ |
| Dark Mode | ❌ | ✅ | ✅ |
| Theme System | ❌ | ✅ | ✅ |

## Best Practices

1. **Use `themeMode` instead of `customStyles`** for consistency
2. **Set `themeMode: 'auto'`** to respect user system preferences
3. **Test both light and dark modes** during development
4. **Maintain color contrast ratios** if customizing colors
5. **Use semantic color names** (primary, destructive, success) instead of specific colors

## Examples

### Example 1: Basic Light Mode

```typescript
const sdk = new MarketplaceSDK({
  applicationId: 'your-app-id',
  themeMode: 'light',
});
```

### Example 2: Dark Mode with Custom Preferences

```typescript
const userPrefersDark = localStorage.getItem('theme') === 'dark';

const sdk = new MarketplaceSDK({
  applicationId: 'your-app-id',
  themeMode: userPrefersDark ? 'dark' : 'light',
});
```

### Example 3: Auto-Detect System Preference

```typescript
const sdk = new MarketplaceSDK({
  applicationId: 'your-app-id',
  themeMode: 'auto', // Automatically detects system preference
});
```

### Example 4: Using Theme Utilities

```typescript
import { getTheme, generateCSSVariables } from '@marketplace/provider-sdk';

// Get current theme
const theme = getTheme(); // Uses auto-detection

// Apply theme to your own components
const cssVars = generateCSSVariables(theme);
document.documentElement.style.cssText = cssVars;
```

## Troubleshooting

### Issue: Modal colors don't match the SPA

**Solution:** Ensure you're using `themeMode` instead of `customStyles`:

```typescript
// ❌ Wrong
const sdk = new MarketplaceSDK({
  customStyles: { /* ... */ },
});

// ✅ Correct
const sdk = new MarketplaceSDK({
  themeMode: 'light',
});
```

### Issue: Dark mode not working

**Solution:** Verify that `themeMode` is set to `'dark'` or `'auto'`:

```typescript
const sdk = new MarketplaceSDK({
  themeMode: 'dark',
});
```

### Issue: Colors look different from SPA

**Solution:** Make sure you're using the latest SDK version that includes the theme system. Rebuild with `npm run build`.

## Resources

- **Source Files:**
  - Theme configuration: `src/styles/theme.ts`
  - Modal implementation: `src/ui/WarningModal.ts`
  - Type definitions: `src/types/index.ts`

- **SPA Reference:**
  - Color palette: `gw-spa/src/styles/globals.css`
  - Tailwind config: `gw-spa/tailwind.config.js`
  - Component styles: `gw-spa/src/components/ui/`

## Summary

The SDK now features a comprehensive design system that:
- ✅ Matches the General Wisdom SPA styling exactly
- ✅ Supports light, dark, and auto themes
- ✅ Uses semantic color names for clarity
- ✅ Includes proper typography and spacing systems
- ✅ Maintains backward compatibility with legacy styles
- ✅ Provides excellent accessibility features
- ✅ Follows modern design patterns from shadcn/ui

For questions or issues, refer to the main SDK documentation or contact the development team.
