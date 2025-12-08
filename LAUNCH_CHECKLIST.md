# fabrix - Beta Launch Checklist

## ✅ Completed Implementation

### 1. Freemium Pricing Model
- ✅ Free tier: 10 scans per month (hard limit)
- ✅ Premium tier: 100 scans per month at $7.99/month
- ✅ Monthly reset on the 1st of each month
- ✅ Scan counter displayed to users

### 2. User Authentication
- ✅ Sign up / Sign in system
- ✅ JWT-based authentication (30-day tokens)
- ✅ Secure password requirements (min 8 characters)
- ✅ Email validation
- ✅ User profile management via Supabase

### 3. Security & Abuse Prevention
- ✅ **Rate Limiting**: 100 requests per 15 min (general), 30 requests per 15 min (AI endpoint)
- ✅ **Daily Abuse Detection**: Auto-flag users exceeding 20 scans/day (free) or 50 scans/day (premium)
- ✅ **Account Suspension**: Flagged users blocked with reason displayed
- ✅ **Input Validation**: Text length limits, URL validation, fiber data validation
- ✅ **XSS Protection**: HTML sanitization in popup
- ✅ **CORS**: Restricted to Chrome/Firefox extensions only
- ✅ **Helmet.js**: Security headers enabled
- ✅ **Request Size Limits**: 50kb max payload

### 4. Extension Features
- ✅ Renamed to "fabrix"
- ✅ Smart composition detection (prioritizes official data over marketing)
- ✅ Multi-section support (Shell, Lining, Trim, Other)
- ✅ Recycled material tracking
- ✅ Duplicate detection with update tracking
- ✅ Check count tracking

---

## 🔧 Setup Required Before Launch

### Step 1: Create .env File
1. Copy `.env.example` to `.env` in the root directory
2. Fill in your API keys:
   ```bash
   cp .env.example .env
   # Then edit .env with your actual keys
   ```

### Step 2: Set Up Supabase Database
1. Create a Supabase project at https://supabase.com
2. Run the SQL in `backend/database/schema.sql` in your Supabase SQL editor
3. Enable email authentication in Supabase Auth settings
4. Copy your Supabase URL and anon key to `.env`

### Step 3: Get OpenAI API Key
1. Create account at https://platform.openai.com
2. Generate API key
3. Add to `.env` file

### Step 4: Generate JWT Secret
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Add the output to `.env` as `JWT_SECRET`

### Step 5: Test Locally
```bash
# Start backend
cd backend
npm install
node server.js

# In another terminal, run tests
node security-tests.js

# Load extension in Chrome:
# 1. Go to chrome://extensions/
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select the ntrl folder
```

---

## 🚀 Deployment Checklist

### Before Publishing to Chrome Web Store

#### 1. Fix Icon Dimensions
- [ ] Current icon is 85x128 (non-standard)
- [ ] Create proper icons: 16x16, 48x48, 128x128
- [ ] Update manifest.json with correct icon paths

#### 2. Deploy Backend Server
- [ ] Choose hosting platform (Railway, Render, Heroku, DigitalOcean, etc.)
- [ ] Deploy backend with environment variables
- [ ] Get production URL (e.g., `https://api.fabrix.com`)
- [ ] Update `manifest.json` host_permissions to production URL
- [ ] Update `popup.js` BACKEND_URL to production URL
- [ ] Test all endpoints in production

#### 3. Create Required Assets
- [ ] **Privacy Policy**: Required for Chrome Web Store (collecting user data)
  - Host at a public URL (e.g., fabrix.com/privacy)
  - Must explain data collection, storage, usage
  - Include in manifest.json: `"privacy_policy": "https://fabrix.com/privacy"`
- [ ] **Store Listing Screenshots**: 1280x800 or 640x400 (minimum 1)
- [ ] **Promotional Images**: 440x280 small tile (optional but recommended)
- [ ] **Detailed Description**: Explain features, benefits, pricing

#### 4. Extension Name
- [ ] "fabrix" may be available - verify on Chrome Web Store
- [ ] Alternative names if taken:
  - Fabrix Scanner
  - Fabrix - Fabric Checker
  - Material Scanner by Fabrix

#### 5. Pricing/Monetization Setup
- [ ] Set up Stripe account for payments
- [ ] Implement Stripe integration for premium upgrades
- [ ] Create pricing page/landing page
- [ ] Add "Upgrade to Premium" button in extension
- [ ] Test payment flow end-to-end

#### 6. Legal & Compliance
- [ ] Create Terms of Service
- [ ] Create Privacy Policy
- [ ] Add GDPR compliance (if targeting EU users)
- [ ] Add cookie consent (if applicable)

#### 7. Testing
- [ ] Test on multiple fashion websites (Zara, H&M, Nordstrom, etc.)
- [ ] Test all composition types (Natural, Synthetic, Mixed, Unknown)
- [ ] Test scan limits (10 for free, 100 for premium)
- [ ] Test daily abuse prevention
- [ ] Test rate limiting
- [ ] Cross-browser testing (Chrome, Edge)

#### 8. Final Code Review
- [ ] Remove all console.log debug statements
- [ ] Remove test accounts from database
- [ ] Verify all error messages are user-friendly
- [ ] Check for any hardcoded localhost URLs
- [ ] Minify/optimize if needed

---

## 📋 Chrome Web Store Submission

### Required Information
1. **Extension Name**: fabrix
2. **Short Description**: Scan fashion products for fabric composition
3. **Detailed Description**:
   ```
   fabrix is a powerful fabric composition scanner for fashion shoppers
   who care about sustainability. Instantly analyze any product page to
   discover if fabrics are natural, synthetic, or mixed.

   Features:
   • AI-powered fabric detection
   • Natural vs synthetic classification
   • Recycled material tracking
   • Personal fabric library
   • Monthly scan limits (10 free, 100 premium)

   Perfect for eco-conscious shoppers who want to make informed decisions
   about the materials in their clothing.
   ```
4. **Category**: Shopping
5. **Language**: English
6. **Privacy Policy URL**: [YOUR PRIVACY POLICY URL]
7. **Support Email**: [YOUR SUPPORT EMAIL]

### Review Timeline
- Initial review: 1-3 days (sometimes longer)
- Be prepared to respond to reviewer questions
- Common rejection reasons:
  - Missing privacy policy
  - Unclear permissions justification
  - Quality issues with icons/screenshots

---

## 🔒 Security Best Practices

### Implemented
✅ Environment variables for secrets
✅ JWT token authentication
✅ Rate limiting
✅ Input validation
✅ SQL injection prevention (using Supabase)
✅ XSS prevention
✅ CORS restrictions
✅ Abuse detection

### Recommended Monitoring
- [ ] Set up error tracking (Sentry, LogRocket, etc.)
- [ ] Monitor API usage/costs
- [ ] Track user signup/churn
- [ ] Monitor abuse reports
- [ ] Set up uptime monitoring

---

## 💰 Monetization Strategy

### Current Plan
- Free: 10 scans/month (acquisition)
- Premium: $7.99/month for 100 scans (monetization)

### Considerations
- Add annual plan ($79.99/year = $6.67/mo) for better LTV
- Consider higher tiers for power users (200 scans = $14.99/mo)
- Add one-time payment option (e.g., $4.99 for 50 scans, no expiry)
- Track conversion rate from free to premium

---

## 📊 Analytics to Track

1. **User Metrics**
   - Daily/Monthly Active Users (DAU/MAU)
   - Sign-ups per day
   - Free to Premium conversion rate
   - Churn rate

2. **Product Metrics**
   - Scans per user
   - Most scanned brands/websites
   - Composition grade distribution (Natural vs Synthetic)
   - Scan success rate (Unknown vs detected)

3. **Technical Metrics**
   - API response times
   - Error rates
   - Rate limit hits
   - Abuse flags

---

## 🐛 Known Issues / Future Improvements

### Current Limitations
- Localhost only (needs deployment)
- No payment integration yet
- No analytics tracking
- No admin dashboard for user management

### Future Features
- Browser extension for Firefox/Edge
- Mobile app
- Brand sustainability ratings
- Carbon footprint calculator
- Export fabric library to CSV
- Share fabric findings with friends
- Browser extension badge showing composition grade

---

## 📞 Support & Maintenance

- Create support email (e.g., support@fabrix.com)
- Set up automated email responses
- Create FAQ page
- Monitor Chrome Web Store reviews
- Plan for regular updates (security patches, new features)

---

## ✅ Final Pre-Launch Checklist

- [ ] All environment variables configured
- [ ] Database schema deployed to Supabase
- [ ] Backend deployed to production
- [ ] Extension tested end-to-end
- [ ] Icons created and optimized
- [ ] Privacy policy published
- [ ] Screenshots captured
- [ ] Store listing drafted
- [ ] Payment system tested (when implemented)
- [ ] Support email set up
- [ ] Monitoring/analytics configured

**When all items are checked, you're ready to submit to Chrome Web Store!**

---

## 🎉 Post-Launch

1. Share on Product Hunt, Reddit (r/sustainability, r/fashion)
2. Reach out to sustainability influencers
3. Write blog post about the tool
4. Monitor reviews and respond quickly
5. Gather user feedback for improvements
6. Plan iteration roadmap
