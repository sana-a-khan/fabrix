# 🚀 Deploy fabrix Backend to Render - Step-by-Step

**Time Required**: 20 minutes
**Cost**: FREE (with cold starts)

---

## ✅ **Pre-Deployment Checklist**

Before we start, make sure you have:

- [ ] GitHub account
- [ ] Code pushed to GitHub repository
- [ ] .env file values ready (you'll need them):
  - OPENAI_KEY
  - SUPABASE_URL
  - SUPABASE_KEY
  - JWT_SECRET

---

## 📋 **Step 1: Push Your Code to GitHub**

If you haven't already:

```bash
# Check current status
git status

# Commit any pending changes
git add -A
git commit -m "Prepare for Render deployment"

# Push to GitHub
git push origin main

# If you don't have a GitHub remote yet:
# 1. Create new repo on GitHub.com (public or private)
# 2. Copy the repo URL
# 3. Run:
git remote add origin https://github.com/yourusername/fabrix.git
git branch -M main
git push -u origin main
```

---

## 🌐 **Step 2: Create Render Account**

1. Go to: https://render.com
2. Click **"Get Started"**
3. Sign up with GitHub (easiest - auto-connects repos)
4. Verify your email

---

## ⚙️ **Step 3: Create New Web Service**

1. Click **"New +"** (top right)
2. Select **"Web Service"**
3. Connect your GitHub repository
   - Click **"Connect account"** if needed
   - Select your **fabrix** repository
   - Click **"Connect"**

---

## 🔧 **Step 4: Configure Service**

### **Basic Settings**:

| Field | Value |
|-------|-------|
| **Name** | `fabrix-backend` (or any name you like) |
| **Region** | `Oregon (US West)` (or closest to you) |
| **Branch** | `main` |
| **Root Directory** | `backend` ⚠️ **IMPORTANT** |
| **Runtime** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `node server.js` |

### **Instance Type**:
- Select **"Free"** (0$/month)
- ⚠️ Note: Free tier sleeps after inactivity (cold starts)

---

## 🔐 **Step 5: Add Environment Variables**

Scroll down to **"Environment Variables"** section.

Click **"Add Environment Variable"** for each:

### **Variable 1: OPENAI_KEY**
```
Key: OPENAI_KEY
Value: sk-proj-... (your OpenAI API key)
```

### **Variable 2: SUPABASE_URL**
```
Key: SUPABASE_URL
Value: https://xxxxx.supabase.co
```

### **Variable 3: SUPABASE_KEY**
```
Key: SUPABASE_KEY
Value: eyJhbGc... (your Supabase anon key)
```

### **Variable 4: JWT_SECRET**
```
Key: JWT_SECRET
Value: (your random 32-byte hex string)
```

**Don't have JWT_SECRET yet?**
```bash
# Generate one:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Copy the output and paste it as JWT_SECRET value
```

### **Variable 5: PORT** (Optional but recommended)
```
Key: PORT
Value: 3000
```

---

## 🚀 **Step 6: Deploy!**

1. Review all settings
2. Click **"Create Web Service"** (bottom of page)
3. Wait for deployment (2-5 minutes)

You'll see logs like:
```
==> Installing dependencies...
==> npm install
==> Building...
==> Starting server...
==> Your service is live 🎉
```

---

## ✅ **Step 7: Get Your Production URL**

Once deployed, Render gives you a URL like:
```
https://fabrix-backend.onrender.com
```

**Copy this URL!** You'll need it next.

---

## 🧪 **Step 8: Test Your Backend**

Test that your backend is working:

```bash
# Test health check (should return 404 - that's okay, means server is running)
curl https://fabrix-backend.onrender.com

# Test signup endpoint (should return error about email)
curl -X POST https://fabrix-backend.onrender.com/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test","password":"test"}'

# If you get a response (even an error), backend is working! ✅
```

**Expected Response**:
```json
{"error": "Valid email required"}
```

This means your backend is **LIVE**! 🎉

---

## 🔄 **Step 9: Update Extension to Use Production URL**

Now update your extension to use the production backend:

### **Update config.js**:

```javascript
const CONFIG = {
  // Change this:
  // BACKEND_URL: "http://localhost:3000",

  // To this:
  BACKEND_URL: "https://fabrix-backend.onrender.com",

  VERSION: "1.0.0",
  DEBUG: false,
};
```

### **Update manifest.json**:

```json
{
  "host_permissions": [
    "https://fabrix-backend.onrender.com/*"
  ],
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'; connect-src 'self' https://fabrix-backend.onrender.com"
  }
}
```

---

## 🎯 **Step 10: Test Extension with Production Backend**

1. Save all files
2. Reload extension in Chrome:
   - Go to `chrome://extensions/`
   - Click reload icon on fabrix extension
3. Test the extension:
   - Go to a fashion website (zara.com, hm.com)
   - Click fabrix icon
   - Try to sign up with a new email
   - Try to scan a product

**If it works, you're LIVE! 🎉**

---

## 📊 **Monitor Your Backend**

### **View Logs**:
1. Go to Render dashboard
2. Click your service
3. Click "Logs" tab
4. See real-time requests

### **Check Status**:
- Green dot = Running ✅
- Yellow = Deploying ⚠️
- Red = Error ❌

---

## ⚠️ **Important: Free Tier Limitations**

### **Cold Starts**:
- Free tier **sleeps after 15 minutes** of inactivity
- First request after sleep takes **30-60 seconds** to wake up
- Subsequent requests are instant

**User Experience**:
- If user hasn't scanned in 15+ minutes, first scan is slow
- After that, scans are fast
- For beta launch, this is **acceptable**

**To Eliminate Cold Starts**:
- Upgrade to paid tier ($7/month)
- Or keep a ping service running (not recommended)

### **Monthly Hours**:
- Free tier: 750 hours/month
- If you have heavy usage, might hit limit
- For beta, this is plenty

---

## 🐛 **Troubleshooting**

### **Deployment Failed**

**Check Build Logs**:
1. Click "Logs" in Render
2. Look for error messages

**Common Issues**:

**Error: "Cannot find module"**
```
Solution: Make sure Root Directory is set to "backend"
```

**Error: "OPENAI_KEY is not defined"**
```
Solution: Add environment variables in Render dashboard
```

**Error: "Port already in use"**
```
Solution: Remove PORT from environment variables (Render sets it automatically)
```

### **Backend Running but Extension Can't Connect**

**Check CORS**:
Your backend already has CORS configured for extensions, but verify:

```javascript
// In server.js - should already be there
const allowedOrigins = [
  "chrome-extension://",
  "moz-extension://",
];
```

**Check URL**:
- Make sure config.js has correct Render URL
- Make sure manifest.json has correct URL
- Make sure there's no trailing slash

### **"Cold start" Taking Too Long**

First request after sleep can take 60 seconds. This is normal on free tier.

**Temporary Fix**:
- Keep a separate tab open hitting your backend every 10 minutes
- Or upgrade to paid tier ($7/mo)

---

## 💡 **Pro Tips**

### **Auto-Deploy on Git Push**:
Render automatically deploys when you push to GitHub. No manual deployment needed!

```bash
git add .
git commit -m "Update feature"
git push origin main
# Render automatically deploys! 🚀
```

### **View Environment Variables**:
Dashboard → Your Service → Environment → Edit

### **Custom Domain** (Optional):
1. Dashboard → Your Service → Settings
2. Click "Add Custom Domain"
3. Follow instructions to add DNS records
4. Use `api.fabrix.com` instead of `fabrix-backend.onrender.com`

---

## 📈 **Next Steps After Deployment**

- [ ] Update config.js with production URL
- [ ] Update manifest.json with production URL
- [ ] Test extension end-to-end
- [ ] Commit and push changes
- [ ] Move on to hosting privacy policy
- [ ] Create screenshots
- [ ] Submit to Chrome Web Store!

---

## ✅ **Deployment Complete Checklist**

- [ ] Render account created
- [ ] Web service created
- [ ] Root directory set to `backend`
- [ ] All 4 environment variables added
- [ ] Service deployed successfully (green status)
- [ ] Backend URL copied
- [ ] config.js updated
- [ ] manifest.json updated
- [ ] Extension tested with production backend
- [ ] Everything works! 🎉

---

## 🎉 **Congratulations!**

You just deployed your backend to production!

**What you've accomplished**:
- ✅ Backend is live 24/7 (with cold starts on free tier)
- ✅ Accessible from anywhere
- ✅ Auto-deploys on git push
- ✅ Secure environment variables
- ✅ Production-ready

**Chrome Web Store Blocker #2: FIXED** ✅

**Remaining**:
- ⚠️ Privacy policy (next step)

---

**Questions? Issues? Let me know and I'll help debug!**
