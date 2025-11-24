# Beta Whitelist Implementation Guide

This guide shows how to add email-based whitelist authentication for a private beta.

## Option A: Simple Email Whitelist (Easiest)

### Backend Changes (server.js)

```javascript
// Add whitelist of beta tester emails
const BETA_WHITELIST = [
  "tester1@example.com",
  "tester2@example.com",
  "yourfriend@gmail.com"
];

// Add simple auth middleware
function checkBetaAccess(req, res, next) {
  const userEmail = req.headers['x-user-email'];

  if (!userEmail || !BETA_WHITELIST.includes(userEmail.toLowerCase())) {
    return res.status(403).json({
      error: "Beta access required. Please contact the developer for access."
    });
  }

  next();
}

// Apply to protected endpoints
app.post("/analyze", aiLimiter, checkBetaAccess, async (req, res) => {
  // existing code...
});

app.post("/save-product", checkBetaAccess, async (req, res) => {
  // existing code...
});
```

### Frontend Changes (popup.js)

```javascript
// Add at top of file
const BETA_USER_EMAIL = "your-tester@example.com"; // Each beta tester gets their own build

// Update API calls to include email
async function analyzeWithAI(text) {
  const response = await fetch(OPENAI_BACKEND_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-User-Email": BETA_USER_EMAIL  // Add this
    },
    body: JSON.stringify({ text }),
  });
  // rest of code...
}

async function saveToSupabase(data, url, title, brand, rawText) {
  const response = await fetch(SUPABASE_BACKEND_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-User-Email": BETA_USER_EMAIL  // Add this
    },
    body: JSON.stringify({...}),
  });
  // rest of code...
}
```

**How to distribute:**
1. Build a separate version for each beta tester with their email
2. Send them the `.zip` file or publish as unlisted on Chrome Web Store
3. Easy to revoke access by removing from whitelist

---

## Option B: Chrome Identity API (More Advanced)

Use Chrome's built-in identity API to get the user's Google email:

### manifest.json Changes

```json
{
  "permissions": [
    "activeTab",
    "scripting",
    "identity",
    "identity.email"
  ],
  "oauth2": {
    "client_id": "YOUR_CLIENT_ID.apps.googleusercontent.com",
    "scopes": ["email"]
  }
}
```

### Frontend Changes (popup.js)

```javascript
// Get user's Google email on extension load
async function getUserEmail() {
  return new Promise((resolve, reject) => {
    chrome.identity.getProfileUserInfo((userInfo) => {
      if (userInfo.email) {
        resolve(userInfo.email);
      } else {
        reject(new Error("Could not get user email"));
      }
    });
  });
}

// Use in API calls
async function analyzeWithAI(text) {
  const userEmail = await getUserEmail();

  const response = await fetch(OPENAI_BACKEND_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-User-Email": userEmail
    },
    body: JSON.stringify({ text }),
  });
  // rest of code...
}
```

**Pros:**
- One extension build for all beta testers
- User can't fake their email (verified by Google)
- Professional authentication

**Cons:**
- Requires Google Cloud Project setup
- More complex implementation

---

## Option C: Database-Based Whitelist (Most Flexible)

Store beta tester list in Supabase:

### Supabase Setup

```sql
-- Create beta_users table
CREATE TABLE beta_users (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  invited_at TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0
);

-- Add your beta testers
INSERT INTO beta_users (email) VALUES
  ('tester1@example.com'),
  ('tester2@example.com');
```

### Backend Changes (server.js)

```javascript
async function checkBetaAccess(req, res, next) {
  const userEmail = req.headers['x-user-email'];

  if (!userEmail) {
    return res.status(403).json({ error: "Beta access required" });
  }

  // Check Supabase for beta access
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/beta_users?email=eq.${userEmail}&is_active=eq.true`,
    {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    }
  );

  const users = await response.json();

  if (!users || users.length === 0) {
    return res.status(403).json({
      error: "Beta access required. Please request access from the developer."
    });
  }

  // Track usage
  await fetch(
    `${SUPABASE_URL}/rest/v1/beta_users?email=eq.${userEmail}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({
        usage_count: users[0].usage_count + 1
      }),
    }
  );

  next();
}
```

**Pros:**
- Easy to add/remove beta testers (just update database)
- Can track usage per tester
- Can set usage limits
- No code changes needed to add testers

---

## Recommended Approach for Your Use Case

**For 5-20 beta testers:**
- Use **Option 1 (Private GitHub)** if testers are technical
- Use **Option 2 (Unlisted Chrome Web Store)** if testers are non-technical
- Add **Option A (Simple Whitelist)** for extra security

**Implementation Steps:**

1. **Keep GitHub repo private**
2. **Deploy backend to Railway/Render**
   - Keep backend URL private (don't share publicly)
   - This alone prevents random people from using your API

3. **Optional: Add email whitelist** (if you want extra security)
   - Use Option A (Simple Email Whitelist)
   - Build separate extension versions per tester

4. **Distribute via Chrome Web Store (Unlisted)**
   - Beta testers get easy installation
   - You control who has the link
   - Automatic updates

---

## Security Considerations for Beta

### What to Keep Private:
- ✅ GitHub repository (set to private)
- ✅ Backend URL (share only with testers)
- ✅ Environment variables (OpenAI key, Supabase key)
- ✅ Extension unlisted link (if using Chrome Web Store)

### What Can Be Semi-Public:
- ⚠️ Extension functionality (testers can inspect the code)
- ⚠️ Backend API structure (testers can see network requests)

### Additional Beta Protection:

**1. Add Usage Limits:**
```javascript
// In backend - limit requests per user
const BETA_LIMITS = {
  "tester1@example.com": 100, // 100 scans per beta period
  "tester2@example.com": 50
};
```

**2. Add Expiration Date:**
```javascript
// Beta ends on specific date
const BETA_END_DATE = new Date("2025-12-31");

function checkBetaAccess(req, res, next) {
  if (new Date() > BETA_END_DATE) {
    return res.status(403).json({
      error: "Beta period has ended. Thank you for testing!"
    });
  }
  next();
}
```

**3. Monitor Costs:**
- Set OpenAI API spending limits
- Monitor Supabase usage
- Set alerts for unusual activity

---

## Quick Start: Simplest Beta Setup

**Easiest path (30 minutes):**

1. Deploy backend to Railway
2. Keep GitHub repo private
3. Update extension with production URLs
4. Create `.zip` of extension
5. Email `.zip` to beta testers with installation instructions
6. They load it as "unpacked extension" in Chrome

**Installation instructions for testers:**
```
1. Download the extension.zip file
2. Unzip it
3. Open Chrome and go to chrome://extensions
4. Enable "Developer mode" (top right)
5. Click "Load unpacked"
6. Select the unzipped extension folder
7. Done! The extension is now installed
```

This keeps everything private and gives you full control!

---

## Need Help Implementing?

Let me know which option you'd like to implement and I can:
1. Add the whitelist code to your backend
2. Update the frontend to send user emails
3. Create beta tester installation instructions
4. Set up the Chrome Web Store unlisted listing
