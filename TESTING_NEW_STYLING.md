# Testing the New Styling System

## Quick Start

The SDK has been updated with a comprehensive theme system that matches the SPA design. Here's how to see it in action:

### 1. Start the Test Server

```bash
cd /Users/patrick.henry/dev/gw-sdk
npm run test-server-p2
```

You should see:
```
🚀 Marketplace SDK Test Server (Phase 2) Running!

📍 Endpoints:
   Simple Example:      http://localhost:3000/example
   Provider Simulation: http://localhost:3000/provider
   🎨 Theme Demo:        http://localhost:3000/theme-demo  <-- NEW!
   JWKS:                http://localhost:3000/.well-known/jwks.json
```

### 2. View the Theme Demo

Open your browser to:
```
http://localhost:3000/theme-demo
```

This demo page shows:
- **Side-by-side comparison** of Light and Dark themes
- **Interactive buttons** to trigger warning modals in each theme
- **Color palettes** showing all the theme colors
- **Auto-detection** demonstration

### 3. Test the Modals

Click the buttons on the theme demo page:

- **"Show Light Modal"** - Shows the modal with light theme colors (matching SPA light mode)
- **"Show Dark Modal"** - Shows the modal with dark theme colors (matching SPA dark mode)
- **"Show Auto-Detected Modal"** - Automatically detects your system's color scheme preference

### 4. Compare with SPA

The colors now match exactly:

#### Primary Button (Extend Session)
- **Light**: Blue `hsl(221.2 83.2% 53.3%)` with white text
- **Dark**: Lighter blue `hsl(217.2 91.2% 59.8%)` for better contrast

#### Destructive Button (End Session)
- **Light**: Red `hsl(0 84.2% 60.2%)` with white text
- **Dark**: Darker red `hsl(0 62.8% 30.6%)` with white text

#### Success Button (in warning modal)
- **Light**: Green `hsl(142 76% 36%)` with white text
- **Dark**: Lighter green `hsl(142 71% 45%)` with white text

## What Changed?

### Before
- Hardcoded colors: `#007bff`, `#ef4444`, etc.
- No dark mode support
- Basic styling

### After
- HSL color format matching SPA
- Full light/dark/auto theme support
- Semantic color names (primary, destructive, success)
- System font stack
- Improved accessibility with focus rings
- Better spacing and typography

## Configuration Options

### Use the New Theme System

```typescript
const sdk = new MarketplaceSDK({
  themeMode: 'light',  // or 'dark' or 'auto'
  // ... other config
});
```

### Legacy Support (Still Works)

```typescript
const sdk = new MarketplaceSDK({
  customStyles: {
    backgroundColor: '#ffffff',
    textColor: '#333333',
    // ...
  },
});
```

## Testing Different Themes

### Light Theme
```typescript
const sdk = new MarketplaceSDK({
  themeMode: 'light',
});
```

### Dark Theme
```typescript
const sdk = new MarketplaceSDK({
  themeMode: 'dark',
});
```

### Auto-Detect System Preference
```typescript
const sdk = new MarketplaceSDK({
  themeMode: 'auto', // Respects user's OS settings
});
```

## Files Updated

1. **src/styles/theme.ts** (NEW) - Complete theme configuration
2. **src/ui/WarningModal.ts** - Updated to use theme system
3. **src/core/MarketplaceSDK.ts** - Added themeMode support
4. **src/types/index.ts** - Added ThemeMode type
5. **src/index.ts** - Export theme utilities
6. **examples/vanilla-js/index.html** - Updated to use themeMode
7. **examples/react/index.html** - Updated to use themeMode
8. **examples/theme-demo.html** (NEW) - Interactive theme demo

## Troubleshooting

### Modal doesn't show new colors

**Solution**: Make sure you rebuilt the SDK after updating:
```bash
npm run build
```

### Server won't start

**Solution**: Make sure you're in the SDK directory:
```bash
cd /Users/patrick.henry/dev/gw-sdk
npm run test-server-p2
```

### Theme demo shows 404

**Solution**: The test server needs to be running. Check that:
1. Server is running: `npm run test-server-p2`
2. Navigate to: `http://localhost:3000/theme-demo`

## Next Steps

1. ✅ View the theme demo: `http://localhost:3000/theme-demo`
2. ✅ Try both light and dark modals
3. ✅ Check your system dark mode and try auto-detection
4. 📝 Update your integration to use `themeMode` instead of `customStyles`
5. 📝 Test with your actual application

## Documentation

For complete details, see:
- **STYLING_GUIDE.md** - Comprehensive styling documentation
- **STYLING_UPDATE_SUMMARY.md** - Technical summary of changes

## Questions?

The styling now perfectly matches the SPA design system with:
- ✅ Same color palette
- ✅ Same typography
- ✅ Same spacing
- ✅ Dark mode support
- ✅ Better accessibility
