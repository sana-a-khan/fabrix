# Deploying fabrix Backend to Vercel

## ⚠️ **Important: Code Changes Required**

Vercel uses serverless functions, not traditional Express servers. You'll need to restructure your code.

## 📁 **New File Structure**

```
backend/
├── api/
│   ├── auth/
│   │   ├── signup.js      # POST /api/auth/signup
│   │   ├── signin.js      # POST /api/auth/signin
│   │   └── me.js          # GET /api/auth/me
│   ├── analyze.js         # POST /api/analyze
│   └── save-product.js    # POST /api/save-product
├── lib/
│   ├── auth.js            # Shared auth middleware
│   ├── validation.js      # Input validation functions
│   └── security.js        # Security utilities
├── vercel.json
└── package.json
```

## 🔄 **Step 1: Create vercel.json**

```json
{
  "version": 2,
  "builds": [
    {
      "src": "api/**/*.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/api/$1"
    }
  ],
  "env": {
    "OPENAI_KEY": "@openai-key",
    "SUPABASE_URL": "@supabase-url",
    "SUPABASE_KEY": "@supabase-key",
    "JWT_SECRET": "@jwt-secret"
  }
}
```

## 📝 **Step 2: Convert Endpoints to Serverless Functions**

### Example: `api/auth/signup.js`

```javascript
import { validateEmail, validatePassword } from '../../lib/validation.js';

export default async function handler(req, res) {
  // Only accept POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { email, password } = req.body;

    // Validation
    if (!validateEmail(email)) {
      return res.status(400).json({ error: 'Valid email required' });
    }

    if (!validatePassword(password)) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Create user in Supabase
    const response = await fetch(`${process.env.SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: process.env.SUPABASE_KEY,
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.msg || data.error_description || 'Signup failed'
      });
    }

    // Generate JWT
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { userId: data.user.id, email: data.user.email },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    return res.status(201).json({
      token,
      user: {
        id: data.user.id,
        email: data.user.email,
        subscription_tier: 'free',
        scans_remaining: 10,
      },
    });
  } catch (error) {
    console.error('Signup error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
```

## ⚡ **Step 3: Rate Limiting with Vercel KV**

You'll need Vercel KV (Redis) for rate limiting:

```javascript
// lib/rate-limit.js
import { kv } from '@vercel/kv';

export async function checkRateLimit(identifier, limit, window) {
  const key = `rate-limit:${identifier}`;
  const now = Date.now();
  const windowMs = window * 60 * 1000;

  // Get current count
  const requests = await kv.zrangebyscore(key, now - windowMs, now);

  if (requests.length >= limit) {
    return { allowed: false, remaining: 0 };
  }

  // Add this request
  await kv.zadd(key, { score: now, member: now.toString() });
  await kv.expire(key, Math.ceil(windowMs / 1000));

  return { allowed: true, remaining: limit - requests.length - 1 };
}
```

**Cost**: Vercel KV starts at $0.25 per 100k requests

## 🚀 **Step 4: Deploy to Vercel**

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
cd backend
vercel

# Set environment variables
vercel env add OPENAI_KEY
vercel env add SUPABASE_URL
vercel env add SUPABASE_KEY
vercel env add JWT_SECRET

# Deploy to production
vercel --prod
```

Your API will be at: `https://your-project.vercel.app/api/`

## ⚠️ **Challenges You'll Face**

### 1. **10-Second Timeout**
Your OpenAI calls might timeout on free tier.

**Solution**:
- Upgrade to Pro ($20/month) for 60s timeout
- Or optimize AI prompts to respond faster

### 2. **Cold Starts**
First request after inactivity is slow (1-3s).

**Solution**:
- Accept it (most users won't notice)
- Or upgrade to Pro for better edge caching

### 3. **Stateless Functions**
Each function call is isolated.

**Solution**:
- Use Vercel KV for rate limiting
- Use Supabase for all persistent data

### 4. **More Complex**
Converting Express to serverless is extra work.

**Solution**:
- Follow this guide carefully
- Test each endpoint individually

## 📊 **Vercel vs Railway Comparison**

| Feature | Vercel | Railway |
|---------|--------|---------|
| **Cost (Free)** | ✅ Yes | ❌ No ($5 credit) |
| **Code Changes** | ⚠️ Major refactor | ✅ Deploy as-is |
| **Timeout** | ⚠️ 10s (free) | ✅ Unlimited |
| **Cold Starts** | ⚠️ Yes | ✅ No |
| **Rate Limiting** | ⚠️ Need KV | ✅ Works out of box |
| **Setup Time** | ⚠️ 4-6 hours | ✅ 30 minutes |
| **Best For** | Next.js, serverless | Express, traditional |

## 🎯 **My Recommendation**

### Use Vercel If:
- ✅ You're comfortable with serverless architecture
- ✅ You want a free option (with limitations)
- ✅ You don't mind refactoring your code
- ✅ You're already using Vercel for other projects

### Use Railway/Render If:
- ✅ You want to deploy in 30 minutes
- ✅ You want no code changes
- ✅ You want no timeout issues
- ✅ You value simplicity over free tier
- ✅ You want always-on, no cold starts

## 🔥 **Easiest Path: Render Free Tier**

If you want free + simple:

```bash
# 1. Go to render.com
# 2. "New Web Service"
# 3. Connect GitHub repo (fabrix)
# 4. Settings:
#    - Build Command: cd backend && npm install
#    - Start Command: node server.js
#    - Branch: main
# 5. Add environment variables (all 4)
# 6. Deploy
```

**Done in 20 minutes. No code changes. Free.**

Cold starts on free tier, but for a beta launch, it's perfect.

---

## 🤔 **My Honest Recommendation**

1. **For Beta Launch (Now)**: Use **Render Free Tier**
   - Free
   - No code changes
   - 20 minutes to deploy
   - Accept cold starts (not a big deal for beta)

2. **For Production (Later)**: Upgrade to **Railway** ($5-10/mo)
   - No cold starts
   - Better performance
   - Still simple

3. **For Vercel Lovers**: Only if you really want Vercel ecosystem
   - Be prepared for 4-6 hours of refactoring
   - Budget for Pro tier ($20/mo) or accept limitations

---

**Bottom line**: Render free tier is your best bet for quick launch. Railway for best performance. Vercel if you want to refactor.

What do you think? Want to stick with Render/Railway, or are you set on Vercel?
