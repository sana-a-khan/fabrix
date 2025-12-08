#!/bin/bash

# fabrix - Build for Chrome Web Store Submission
# This script creates a clean ZIP file ready for submission

set -e  # Exit on error

echo "╔══════════════════════════════════════════════════════╗"
echo "║     fabrix - Chrome Web Store Build Script          ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# Check if production URL is set
BACKEND_URL=$(grep "BACKEND_URL:" config.js | grep -o '"[^"]*"' | tr -d '"')

if [[ "$BACKEND_URL" == "http://localhost:3000" ]]; then
  echo "⚠️  WARNING: Backend URL is still localhost!"
  echo ""
  echo "Please update config.js with your production URL:"
  echo "  BACKEND_URL: \"https://your-app.railway.app\","
  echo ""
  read -p "Continue anyway? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Build cancelled"
    exit 1
  fi
fi

# Check icon sizes
echo "🔍 Checking icons..."

if [ -f "icons/icon-16.png" ] && [ -f "icons/icon-48.png" ] && [ -f "icons/icon-128.png" ]; then
  echo "✅ Icons found"
else
  echo "⚠️  WARNING: Icon files not found in icons/ directory"
  echo "   Expected: icons/icon-16.png, icons/icon-48.png, icons/icon-128.png"
  echo ""
  read -p "Continue anyway? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Build cancelled"
    echo ""
    echo "📝 To create icons, run:"
    echo "   mkdir -p icons"
    echo "   # Then resize your icon to 16x16, 48x48, 128x128"
    exit 1
  fi
fi

# Create build directory
echo ""
echo "📦 Creating build directory..."
rm -rf build
mkdir -p build

# Copy necessary files
echo "📋 Copying extension files..."
cp manifest.json build/
cp popup.html build/
cp popup.js build/
cp config.js build/

# Copy icons if they exist
if [ -d "icons" ]; then
  cp -r icons build/
else
  echo "⚠️  No icons directory found"
fi

# Create ZIP file
VERSION=$(grep '"version"' manifest.json | grep -o '"[0-9.]*"' | tr -d '"')
ZIP_NAME="fabrix-v${VERSION}.zip"

echo "🗜️  Creating ZIP file: $ZIP_NAME"
cd build
zip -r "../$ZIP_NAME" * > /dev/null
cd ..

# Verify ZIP contents
echo ""
echo "✅ Build complete!"
echo ""
echo "📦 ZIP file created: $ZIP_NAME"
echo "📊 ZIP contents:"
unzip -l "$ZIP_NAME"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║              ✅ BUILD SUCCESSFUL!                     ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "📝 Next steps:"
echo "  1. Test the extension:"
echo "     - Go to chrome://extensions/"
echo "     - Enable Developer mode"
echo "     - Click 'Load unpacked'"
echo "     - Select the 'build' folder"
echo "     - Test all functionality"
echo ""
echo "  2. When ready to submit:"
echo "     - Go to chrome.google.com/webstore/devconsole"
echo "     - Click 'New Item'"
echo "     - Upload $ZIP_NAME"
echo "     - Fill in store listing details"
echo "     - Submit for review"
echo ""
echo "📚 See CHROME_WEB_STORE_CHECKLIST.md for complete guide"
echo ""

# Cleanup
read -p "Remove build directory? (Y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
  rm -rf build
  echo "✅ Build directory removed"
fi

echo ""
echo "🎉 Ready for Chrome Web Store submission!"
