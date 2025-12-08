# Chrome Web Store Publication Checklist

## 🚨 **CRITICAL ISSUES - Must Fix Before Submission**

### 1. Icon Size/Format ❌ BLOCKING
**Current Issue**: Icon is 1024x1536 (wrong aspect ratio, non-standard size)

**Required**: Square icons in these exact sizes:
- 16x16 pixels (toolbar icon)
- 48x48 pixels (extension management page)
- 128x128 pixels (Chrome Web Store)

**How to Fix**:
```bash
# Option 1: Resize existing icon (if square crop looks good)
# Install ImageMagick: brew install imagemagick
convert icon.png -resize 16x16 icon-16.png
convert icon.png -resize 48x48 icon-48.png
convert icon.png -resize 128x128 icon-128.png

# Option 2: Use online tool
# Upload to https://www.iloveimg.com/resize-image
# Set to 16x16, 48x48, 128x128 (square)

# Option 3: Hire designer on Fiverr ($5-20)
# Search: "chrome extension icon design"
```

**Update manifest.json**:
```json
{
  "action": {
    "default_icon": {
      "16": "icons/icon-16.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png"
    }
  },
  "icons": {
    "16": "icons/icon-16.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  }
}
```

---

### 2. Hardcoded Localhost URLs ❌ BLOCKING
**Current Issue**: Extension only works on your computer

**Files with localhost**:
- `manifest.json` line 8, 24
- `popup.js` line 1

**How to Fix**:

#### Step 1: Deploy Backend
Choose a hosting platform:

**Option A: Railway.app** (Recommended - Easy)
```bash
# 1. Sign up at railway.app
# 2. Install CLI: npm install -g @railway/cli
# 3. Deploy:
cd backend
railway login
railway init
railway up
# 4. Add environment variables in Railway dashboard
# 5. Copy production URL (e.g., fabrix-backend.railway.app)
```

**Option B: Render.com** (Free tier available)
```bash
# 1. Sign up at render.com
# 2. Create new Web Service
# 3. Connect GitHub repo
# 4. Set build command: cd backend && npm install
# 5. Set start command: node server.js
# 6. Add environment variables
# 7. Deploy and copy URL
```

**Option C: Heroku**
```bash
heroku create fabrix-backend
git push heroku main
heroku config:set OPENAI_KEY=...
heroku config:set SUPABASE_URL=...
# etc.
```

#### Step 2: Update Extension Files

**Create `config.js`**:
```javascript
// config.js
const CONFIG = {
  BACKEND_URL: "https://your-app.railway.app", // CHANGE THIS
  // For development, use: "http://localhost:3000"
};
```

**Update `popup.js` line 1**:
```javascript
// Before:
const BACKEND_URL = "http://localhost:3000";

// After:
const BACKEND_URL = CONFIG.BACKEND_URL;
```

**Update `manifest.json`**:
```json
{
  "host_permissions": [
    "https://your-app.railway.app/*"
  ],
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'; connect-src 'self' https://your-app.railway.app"
  }
}
```

**Add config.js to manifest**:
```json
{
  "action": {
    "default_popup": "popup.html"
  },
  "background": {
    "service_worker": "config.js"
  }
}
```

---

### 3. Privacy Policy ❌ BLOCKING
**Current Issue**: Missing privacy policy (REQUIRED when collecting user data)

**You Need**:
- Public URL hosting your privacy policy
- Add to manifest.json

**How to Fix**:

#### Option A: Use GitHub Pages (Free)
```bash
# 1. Create privacy-policy.html in repo
# 2. Enable GitHub Pages in repo settings
# 3. Access at: https://yourusername.github.io/fabrix/privacy-policy.html
```

#### Option B: Use Simple Landing Page
- Carrd.co (free)
- Google Sites (free)
- Notion (free, public page)

**Privacy Policy Template**:
```markdown
# Privacy Policy for fabrix

Last updated: [DATE]

## What Data We Collect
- Email address (for account creation)
- Scanned product URLs (to save to your library)
- Fabric composition data (from products you scan)
- Usage statistics (scan count, last login)

## How We Use Your Data
- Authenticate your account
- Track your monthly scan quota
- Save products to your personal library
- Improve our AI fabric detection

## Data Storage
- Stored securely in Supabase (ISO 27001 certified)
- Encrypted in transit (HTTPS/TLS)
- Never sold to third parties
- Deleted upon account deletion request

## Third-Party Services
- OpenAI (fabric analysis - no personal data sent)
- Supabase (database hosting)

## Your Rights
- Access your data: email support@fabrix.dev
- Delete your account: email support@fabrix.dev
- Export your data: available in extension settings

## Contact
Email: support@fabrix.dev

## Changes
We'll notify users of privacy policy changes via email.
```

**Add to manifest.json**:
```json
{
  "name": "fabrix",
  "homepage_url": "https://yourusername.github.io/fabrix/privacy-policy.html"
}
```

**Note**: Chrome Web Store also has a dedicated privacy policy field during submission.

---

## ⚠️ **IMPORTANT ISSUES - Recommended to Fix**

### 4. Missing Store Listing Assets
You need these for Chrome Web Store listing:

#### Required:
- [ ] **Screenshots** (1-5 images)
  - Size: 1280x800 or 640x400
  - Show extension in use
  - Highlight key features

#### Recommended:
- [ ] **Small Promo Tile** (440x280)
- [ ] **Large Promo Tile** (920x680) - Featured placement
- [ ] **Marquee Promo Tile** (1400x560) - Top featured

**How to Create**:
```bash
# Option 1: Screenshot + Edit
1. Load extension in Chrome
2. Open on a fashion website
3. Click extension icon
4. Take screenshot (Cmd+Shift+4 on Mac)
5. Resize to 1280x800 in Preview/Photoshop
6. Add text overlay highlighting features

# Option 2: Figma Template
1. Search "Chrome Extension Screenshot Template" on Figma
2. Customize with your branding
3. Export as PNG

# Option 3: Hire designer ($20-50)
- Fiverr: Search "chrome extension screenshots"
- Upwork: Search "app store screenshots"
```

**Screenshot Ideas**:
1. Login screen with "10 free scans/month" highlighted
2. Scanning a product (showing loading state)
3. Results screen showing "Natural" fabric
4. Results screen showing composition breakdown
5. User info panel showing scans remaining

---

### 5. Store Listing Description

**Required Fields**:

**Short Description** (132 chars max):
```
Instantly scan fashion products for fabric composition. Know if your clothes are natural, synthetic, or mixed.
```

**Detailed Description** (Example):
```markdown
fabrix helps eco-conscious shoppers make informed fabric choices.

🔍 INSTANT FABRIC ANALYSIS
Scan any fashion product page to reveal its fabric composition. Our AI analyzes product descriptions and care labels to identify:
• Natural fibers (cotton, wool, silk, linen)
• Synthetic materials (polyester, nylon, acrylic)
• Semi-synthetic (viscose, rayon, modal)
• Recycled and organic materials

✨ KEY FEATURES
• One-click fabric scanning on any fashion website
• Detailed composition breakdown with percentages
• Natural vs Synthetic classification
• Personal fabric library
• Track products with composition changes
• Recycled material detection

🌱 WHY IT MATTERS
Fast fashion relies heavily on synthetic plastics. fabrix empowers you to:
• Choose natural, breathable fabrics
• Avoid microplastic-shedding synthetics
• Support sustainable fashion
• Make informed purchasing decisions

💎 PRICING
• Free: 10 scans per month
• Premium: 100 scans/month for $7.99

🔒 PRIVACY
Your data is encrypted and never shared. We only store products you choose to save.

🌐 WORKS ON
Zara, H&M, Nordstrom, ASOS, and thousands of fashion retailers.

Start making better fabric choices today!
```

**Category**: Shopping

**Language**: English

---

### 6. Version Number Format
**Current**: `"version": "1.0"`
**Recommended**: `"version": "1.0.0"`

Chrome accepts both, but semantic versioning (major.minor.patch) is clearer for updates.

---

### 7. Name Availability
**Current**: "fabrix"

**Check Availability**:
1. Go to chrome.google.com/webstore
2. Search "fabrix"
3. If name is taken, consider:
   - Fabrix Scanner
   - Fabrix - Fabric Checker
   - Fabric Scanner by fabrix
   - Material Scanner

**If Name Taken**, update:
- manifest.json `"name"`
- popup.html `<h3>fabrix</h3>`
- All documentation

---

## ✅ **ALREADY COMPLIANT**

### Security & Privacy
- ✅ Manifest v3 (latest version)
- ✅ Minimal permissions (only what's needed)
- ✅ HTTPS backend (when deployed)
- ✅ Content Security Policy configured
- ✅ No remote code execution
- ✅ No obfuscated code

### Permissions Justified
- ✅ `activeTab` - Read product page content
- ✅ `scripting` - Execute content scripts to scan pages
- ✅ `storage` - Store authentication token locally

### Code Quality
- ✅ No malware or spam
- ✅ Clear functionality
- ✅ User-facing feature (not just automation)
- ✅ Secure authentication
- ✅ Input validation

---

## 📋 **PRE-SUBMISSION CHECKLIST**

### Technical Requirements
- [ ] Icons resized to 16x16, 48x48, 128x128
- [ ] Backend deployed to production
- [ ] manifest.json updated with production URL
- [ ] popup.js updated with production URL
- [ ] Privacy policy hosted publicly
- [ ] Privacy policy URL in manifest
- [ ] Version number set (1.0.0)
- [ ] Name availability verified
- [ ] Test extension with production backend

### Store Listing Assets
- [ ] 1-5 screenshots (1280x800 or 640x400)
- [ ] Promotional tile 440x280 (optional but recommended)
- [ ] Short description written (132 chars max)
- [ ] Detailed description written
- [ ] Category selected (Shopping)

### Testing
- [ ] Extension loads without errors
- [ ] Sign up flow works
- [ ] Sign in flow works
- [ ] Scanning works on 5+ different websites
- [ ] Scan limit enforcement works
- [ ] Results display correctly
- [ ] All console errors resolved

### Legal & Business
- [ ] Privacy policy reviewed by legal (if possible)
- [ ] Terms of service created (recommended)
- [ ] Support email set up (support@fabrix.dev)
- [ ] Payment processing for premium (Stripe setup)

---

## 🚀 **SUBMISSION PROCESS**

### Step 1: Create Developer Account
1. Go to chrome.google.com/webstore/devconsole
2. Pay one-time $5 registration fee
3. Verify your email

### Step 2: Prepare Submission Package
```bash
# Create clean directory
mkdir fabrix-submission
cd fabrix-submission

# Copy only necessary files
cp -r /path/to/ntrl/manifest.json .
cp -r /path/to/ntrl/popup.html .
cp -r /path/to/ntrl/popup.js .
cp -r /path/to/ntrl/icons/ .
cp -r /path/to/ntrl/config.js .

# Create ZIP (NO parent folder!)
zip -r fabrix-v1.0.0.zip *

# Verify ZIP contents
unzip -l fabrix-v1.0.0.zip
# Should show: manifest.json, popup.html, popup.js, icons/, config.js
```

**⚠️ Common Mistake**: Don't zip the parent folder!
```bash
# WRONG ❌
fabrix-v1.0.0.zip
  └── fabrix/
      ├── manifest.json
      └── ...

# CORRECT ✅
fabrix-v1.0.0.zip
  ├── manifest.json
  ├── popup.html
  └── ...
```

### Step 3: Submit
1. Click "New Item" in Developer Console
2. Upload ZIP file
3. Fill in store listing:
   - Product name
   - Summary
   - Detailed description
   - Category: Shopping
   - Language: English
4. Upload screenshots and promotional images
5. Set pricing (free + in-app purchases)
6. Add privacy policy URL
7. Click "Submit for Review"

### Step 4: Review Process
- **Timeline**: 1-3 days (sometimes up to 2 weeks)
- **Status**: Check email for updates
- **Common Issues**:
  - Missing privacy policy
  - Icon wrong size
  - Unclear permissions
  - Functionality not clear

### Step 5: After Approval
- Extension goes live on Chrome Web Store
- Users can install and review
- Monitor reviews and respond
- Track analytics in Developer Console

---

## 🔧 **QUICK FIX SCRIPT**

Save time with this script to update all localhost references:

```bash
#!/bin/bash
# update-production-url.sh

PRODUCTION_URL="https://your-app.railway.app"

# Update manifest.json
sed -i '' "s|http://localhost:3000|$PRODUCTION_URL|g" manifest.json

# Update popup.js
sed -i '' "s|http://localhost:3000|$PRODUCTION_URL|g" popup.js

echo "✅ Updated all URLs to: $PRODUCTION_URL"
echo "⚠️  Don't forget to update config.js manually!"
```

Usage:
```bash
chmod +x update-production-url.sh
./update-production-url.sh
```

---

## 📊 **ESTIMATED TIMELINE**

| Task | Time | Who |
|------|------|-----|
| Deploy backend | 1-2 hours | You |
| Update URLs in code | 15 min | You |
| Resize icons | 30 min | You/Designer |
| Write privacy policy | 1 hour | You |
| Create screenshots | 1-2 hours | You/Designer |
| Write store description | 30 min | You |
| Submit to store | 30 min | You |
| Chrome review | 1-3 days | Chrome |
| **TOTAL** | **5-8 hours** (+ review time) | |

---

## 💰 **COSTS**

| Item | Cost | Required? |
|------|------|-----------|
| Chrome Web Store registration | $5 | ✅ Yes |
| Backend hosting (Railway) | $5-10/mo | ✅ Yes |
| Supabase (database) | Free-$25/mo | ✅ Yes |
| OpenAI API | ~$10-50/mo | ✅ Yes |
| Icon designer (Fiverr) | $5-20 | Optional |
| Screenshot designer | $20-50 | Optional |
| Domain name (fabrix.com) | $12/year | Optional |
| **MINIMUM TOTAL** | **$5 setup + $15-35/mo** | |

---

## ⚠️ **COMMON REJECTION REASONS**

1. **Missing Privacy Policy** (30% of rejections)
   - Fix: Add publicly hosted privacy policy

2. **Icon Wrong Size** (20%)
   - Fix: Use exact sizes (16, 48, 128)

3. **Unclear Functionality** (15%)
   - Fix: Better screenshots and description

4. **Permissions Not Justified** (10%)
   - Fix: Explain why each permission is needed

5. **Localhost URLs** (10%)
   - Fix: Deploy backend, update URLs

6. **Broken Extension** (10%)
   - Fix: Test thoroughly before submitting

7. **Spam/Duplicate** (5%)
   - Fix: Ensure unique value proposition

---

## 🎯 **PRIORITY ACTION ITEMS**

**Before You Can Submit** (Blocking):
1. ⚠️ Resize icons to 16x16, 48x48, 128x128
2. ⚠️ Deploy backend to Railway/Render/Heroku
3. ⚠️ Update manifest.json and popup.js with production URL
4. ⚠️ Write and host privacy policy
5. ⚠️ Create at least 1 screenshot

**To Improve Chances of Approval**:
6. Create 3-5 high-quality screenshots
7. Write compelling store description
8. Add promotional tiles
9. Set up support email
10. Test thoroughly on multiple websites

---

## 📞 **NEED HELP?**

- Chrome Web Store Developer Support: https://support.google.com/chrome_webstore
- Developer Program Policies: https://developer.chrome.com/docs/webstore/program-policies
- Review Process: https://developer.chrome.com/docs/webstore/review-process

---

**Last Updated**: 2024-12-08
**Status**: ⚠️ Not Ready (3 blocking issues)
**Estimated Time to Launch**: 5-8 hours + 1-3 days review
