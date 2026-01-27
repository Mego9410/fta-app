# FTA Marketing Landing Page

This is a standalone marketing landing page for the FTA app. It's completely independent from the main app and can be deployed separately.

## Files

- `index.html` - The main landing page (standalone HTML/CSS/JavaScript)
- `FTA.jpg` - Logo image

## Deployment

This page can be deployed to any static hosting service:

1. **Netlify**: Drag and drop the `public` folder
2. **Vercel**: Deploy the `public` folder
3. **GitHub Pages**: Push to a `gh-pages` branch
4. **Any web server**: Upload the files to your web server

## Customization

Before deploying, update these in `index.html`:

1. **App Store URL** (line ~420): Replace `https://apps.apple.com/app/placeholder` with your actual App Store URL
2. **Google Play URL** (line ~424): Replace `https://play.google.com/store/apps/details?id=placeholder` with your actual Google Play URL
3. **App Screenshots**: Replace the placeholder phone screen content (around line ~350) with actual app screenshots
4. **Contact Email**: Update `oliver.acton@ft-associates.com` if needed
5. **Support/Privacy/Terms Links**: Update URLs if they've changed

## Features

- ✅ Fully responsive (mobile, tablet, desktop)
- ✅ Animated phone mockup that rotates on scroll
- ✅ Floating background shapes
- ✅ Smooth fade-in animations
- ✅ No dependencies - pure HTML/CSS/JavaScript
- ✅ Fast loading - no framework overhead
- ✅ SEO-friendly

## Testing Locally

Simply open `index.html` in your browser, or use a local server:

```bash
# Python
python -m http.server 8000

# Node.js
npx serve public

# Then visit http://localhost:8000
```
