# 🚀 Quick Test Guide - New Styling System

## The Problem You Had

The "purple background crap" is just the example page styling - **you need to trigger the WARNING MODAL to see the new theme system**!

## ⚡ FASTEST Way to See New Styling

### Option 1: Theme Demo (No JWT needed!)

```bash
npm run test-server-p2
```

Open: **http://localhost:3000/theme-demo**

Click the buttons to instantly see light/dark modals! 🎨

### Option 2: Provider Page with Manual Trigger

1. **Start Server:**
```bash
npm run test-server-p2
```

2. **Generate SHORT JWT (5 minutes):**
```bash
npm run generate-jwt 5
```

3. **Copy the URL** from output (looks like):
```
http://localhost:3000/provider?gwSession=eyJhbGc...
```

4. **Open in browser** - You'll see the purple page (that's normal!)

5. **Click the BLUE button** labeled:
```
👁️ Preview Warning Modal (New Styling!)
```

**BOOM! 💥** You'll see the new modal with SPA styling!

## What You'll See

### New Warning Modal Features:

✅ **Colors match SPA exactly:**
- Primary button: `hsl(221.2 83.2% 53.3%)` (brand blue)
- Destructive button: `hsl(0 84.2% 60.2%)` (error red)
- Success button: `hsl(142 76% 36%)` (action green)

✅ **Auto dark mode support:**
- Changes based on your system settings
- Try `themeMode: 'dark'` or `'light'` or `'auto'`

✅ **Better styling:**
- System font stack
- Proper spacing
- Focus rings for accessibility
- Smooth animations

### The Purple Background?

That's just the example page design - it's not part of the SDK! The SDK only controls the **modal** that pops up.

The purple gradient is in the HTML file at `/examples/react/index.html` lines 205-210:
```css
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
```

This is just for demo aesthetics - **your actual app won't have this**.

## Waiting for Automatic Warning?

If you want to wait for the warning to show automatically:

1. Generate a **5-minute JWT:**
```bash
npm run generate-jwt 5
```

2. Open the provider URL

3. **Wait 1 minute** - the warning modal will appear automatically!
   - (It shows when 4 minutes remain, since `warningThresholdSeconds: 240`)

## Compare Old vs New

### Old Modal (Before):
- Hardcoded colors
- No dark mode
- Generic blue (#007bff)
- Basic styling

### New Modal (Now):
- ✅ SPA color system
- ✅ Dark/light/auto themes
- ✅ HSL colors matching design
- ✅ Better accessibility
- ✅ System font stack

## Three Ways to Test

| Method | Speed | Requires JWT? | Best For |
|--------|-------|---------------|----------|
| **Theme Demo** | Instant | ❌ No | Comparing light/dark |
| **Manual Button** | Instant | ✅ Yes | Testing with session |
| **Wait for Warning** | 1 min | ✅ Yes | Full workflow test |

## Troubleshooting

### "I only see purple background"

✅ **That's correct!** The purple is the page background. Click the **"Preview Warning Modal"** button to see the SDK styling.

### "The modal looks the same"

❌ Make sure you rebuilt: `npm run build`
❌ Check the server is serving the new dist files
❌ Try hard refresh (Cmd+Shift+R / Ctrl+F5)

### "I don't see a preview button"

✅ Make sure you're using the **provider** page:
```
http://localhost:3000/provider?gwSession=YOUR_TOKEN
```

Not the simple example page.

## Summary

🎨 **The new styling is in the MODAL, not the page background!**

**Fastest test:**
1. `npm run test-server-p2`
2. Open: `http://localhost:3000/theme-demo`
3. Click "Show Light Modal" or "Show Dark Modal"

**With JWT:**
1. `npm run generate-jwt 5`
2. Open the provider URL
3. Click "Preview Warning Modal" button

The purple background is just example page styling - the SDK only controls the modal popup! 🎉
