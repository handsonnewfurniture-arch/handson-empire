# 🚀 HANDSON EMPIRE - DEPLOYMENT GUIDE

Complete deployment instructions for all 3 platforms + backend.

---

## 📋 PREREQUISITES

1. **Supabase account** (database)
   - Go to: https://supabase.com
   - Create project (already have: `hzcgpuctetpfmxisehhe`)

2. **Twilio account** (SMS alerts)
   - Go to: https://twilio.com
   - Get Account SID + Auth Token + Phone Number

3. **Railway account** (backend hosting)
   - Go to: https://railway.app
   - Connect GitHub account

4. **Netlify account** (frontend hosting)
   - Go to: https://netlify.com
   - Connect GitHub account

---

## 🗄️ STEP 1: SET UP DATABASE

### Option A: Supabase Dashboard (Recommended)

1. Go to: https://supabase.com/dashboard/project/hzcgpuctetpfmxisehhe
2. Click **SQL Editor** in left sidebar
3. Copy contents of `backend/supabase-schema.sql`
4. Paste and click **Run**
5. ✅ All tables created with seed data!

### Option B: Supabase CLI

```bash
cd backend
supabase db push
```

### Get your Supabase keys:

1. Dashboard → Settings → API
2. Copy **Project URL** and **anon/public key**
3. Save for next step

---

## ⚙️ STEP 2: CONFIGURE BACKEND

### Create environment file:

```bash
cd ~/handson-empire/backend
cp .env.example .env
nano .env  # or: open -e .env
```

### Add your credentials:

```bash
# Server
PORT=3000

# Supabase (from dashboard → Settings → API)
SUPABASE_URL=https://hzcgpuctetpfmxisehhe.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key-here
SUPABASE_SERVICE_KEY=your-supabase-service-key-here

# Twilio (from console.twilio.com)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your-auth-token-here
TWILIO_PHONE=+17744687657

# Scraper Settings
SCRAPE_INTERVAL=300000
ENABLE_AUTO_SCRAPE=true

# AI (optional - for enhanced lead scoring)
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxx
```

**⚠️ IMPORTANT:** Never commit `.env` to git!

---

## 🚂 STEP 3: DEPLOY BACKEND TO RAILWAY

### Option A: Railway Dashboard (Easiest)

1. Go to: https://railway.app/new
2. Click **Deploy from GitHub repo**
3. Select: `handsonnewfurniture-arch/handson-empire`
4. Railway auto-detects `backend/` folder
5. Click **Add variables** and paste your `.env` contents
6. Click **Deploy**
7. ✅ Backend live in ~2 minutes!

### Option B: Railway CLI

```bash
cd ~/handson-empire/backend

# Login
railway login

# Create new project
railway init

# Add environment variables
railway variables set SUPABASE_URL=https://hzcgpuctetpfmxisehhe.supabase.co
railway variables set SUPABASE_ANON_KEY=your-key-here
railway variables set TWILIO_ACCOUNT_SID=your-sid-here
railway variables set TWILIO_AUTH_TOKEN=your-token-here
railway variables set TWILIO_PHONE=+17744687657

# Deploy
railway up

# Get URL
railway domain
```

### Enable auto-deployment:

Railway automatically redeploys when you push to GitHub main branch!

---

## 🌐 STEP 4: DEPLOY FRONTENDS TO NETLIFY

### Customer Platform:

```bash
cd ~/handson-empire/customer
netlify deploy --prod --dir=.
```

**Custom domain:** `customer.handson.ventures`

### Worker Platform:

```bash
cd ~/handson-empire/worker
netlify deploy --prod --dir=.
```

**Custom domain:** `worker.handson.ventures`

### Admin Platform:

```bash
cd ~/handson-empire/admin
netlify deploy --prod --dir=.
```

**Custom domain:** `admin.handson.ventures`

### Set up custom domains:

1. Go to: https://app.netlify.com
2. Select your site
3. Site settings → Domain management
4. Add custom domain
5. Update DNS (Netlify provides instructions)

---

## 🔗 STEP 5: CONNECT FRONTENDS TO BACKEND

Update API URLs in each platform to point to your Railway backend:

### Get your Railway backend URL:

```bash
cd ~/handson-empire/backend
railway domain
```

Output: `https://handson-empire-production.up.railway.app`

### Update frontend files:

**Customer platform** (`customer/index.html`):
- No backend calls (standalone)

**Worker platform** (`worker/index.html`):
```javascript
// Line ~230 - Update these URLs:
const res = await fetch('https://YOUR-RAILWAY-URL.up.railway.app/api/leads');

// Line ~242 - WebSocket connection:
this.ws = new WebSocket('wss://YOUR-RAILWAY-URL.up.railway.app');
```

**Admin platform** (`admin/index.html`):
```javascript
// Line ~300 - Update these URLs:
fetch('https://YOUR-RAILWAY-URL.up.railway.app/api/leads')
fetch('https://YOUR-RAILWAY-URL.up.railway.app/api/workers')

// Line ~320 - WebSocket:
this.ws = new WebSocket('wss://YOUR-RAILWAY-URL.up.railway.app');
```

Then redeploy:
```bash
cd worker && netlify deploy --prod
cd ../admin && netlify deploy --prod
```

---

## 🕷️ STEP 6: SET UP AUTO-SCRAPING

### Option A: Railway Cron (Recommended)

Add to `backend/package.json`:
```json
{
  "scripts": {
    "start": "node server.js",
    "scrape": "node scraper.js"
  },
  "cron": [
    {
      "schedule": "*/5 * * * *",
      "command": "npm run scrape"
    }
  ]
}
```

Railway will run scraper every 5 minutes automatically!

### Option B: External Cron Service

Use **cron-job.org** or **EasyCron**:

1. Create account at https://cron-job.org
2. Add new job:
   - URL: `https://YOUR-RAILWAY-URL.up.railway.app/api/scrape`
   - Schedule: `*/5 * * * *` (every 5 min)
   - Method: POST
3. Save and enable

### Option C: Manual Scraping

```bash
cd ~/handson-empire/backend
node scraper.js
```

Run this whenever you want fresh leads.

---

## ✅ STEP 7: VERIFY DEPLOYMENT

### Test backend:

```bash
curl https://YOUR-RAILWAY-URL.up.railway.app/health
```

Should return:
```json
{
  "status": "TURBO",
  "websockets": 0,
  "timestamp": 1234567890
}
```

### Test customer platform:

1. Open: `https://customer.handson.ventures`
2. Click a trade (e.g., "Movers")
3. Fill out form
4. Click "Find My Match"
5. ✅ Should show matched worker

### Test worker platform:

1. Open: `https://worker.handson.ventures`
2. ✅ Should connect via WebSocket (green dot)
3. ✅ Should show lead feed
4. Click a lead → ✅ Modal opens
5. Click "Claim Lead" → ✅ Lead marked as claimed

### Test admin platform:

1. Open: `https://admin.handson.ventures`
2. ✅ Dashboard loads with stats
3. ✅ Charts render
4. ✅ Scrapers tab shows all sources
5. Click "Run All Scrapers" → ✅ Triggers scrape

### Test SMS alerts (if Twilio configured):

```bash
# Create a CRITICAL lead manually:
curl -X POST https://YOUR-RAILWAY-URL.up.railway.app/api/leads \
  -H "Content-Type: application/json" \
  -d '{
    "trade": "movers",
    "title": "TEST CRITICAL LEAD",
    "city": "Denver",
    "state": "CO",
    "source": "Manual Test",
    "signal_type": "DIRECT_AD",
    "score": 95,
    "priority": "CRITICAL",
    "revenue": 5000,
    "urgency": "immediate",
    "phone": "555-555-5555"
  }'
```

✅ Worker should receive SMS alert within 1 second!

---

## 🔄 CONTINUOUS DEPLOYMENT

**Automatic deployment is now active!**

Whenever you push to GitHub:

```bash
cd ~/handson-empire

# Make changes to any file...

git add .
git commit -m "Add new feature"
git push origin main
```

1. **GitHub Actions** runs tests
2. **Railway** auto-deploys backend
3. **Netlify** auto-deploys frontends (if connected)

Monitor deployments:
- Railway: https://railway.app/dashboard
- Netlify: https://app.netlify.com
- GitHub Actions: https://github.com/handsonnewfurniture-arch/handson-empire/actions

---

## 🐛 TROUBLESHOOTING

### Backend won't start:

```bash
# Check Railway logs:
railway logs

# Common issues:
# 1. Missing environment variables → Add in Railway dashboard
# 2. Supabase connection failed → Check SUPABASE_URL and keys
# 3. Port already in use → Railway handles this automatically
```

### Frontend not connecting to backend:

1. Check CORS settings in `backend/server.js`
2. Verify Railway URL is correct in frontend files
3. Check browser console for errors (F12)

### Scraper not finding leads:

1. Check scraper logs: `node scraper.js`
2. Verify Supabase connection
3. Some sites block scrapers - this is normal

### SMS not sending:

1. Verify Twilio credentials in Railway environment
2. Check Twilio console for error messages
3. Ensure phone number is verified (Twilio trial accounts)

---

## 📊 MONITORING

### Backend health:

```bash
watch -n 10 'curl https://YOUR-RAILWAY-URL.up.railway.app/health'
```

### Database stats:

Supabase Dashboard → Database → Tables → Row counts

### Scraper performance:

Admin dashboard → Scrapers tab → Status indicators

---

## 🎯 NEXT STEPS

1. ✅ Set up custom domains
2. ✅ Enable SSL (automatic on Railway/Netlify)
3. ✅ Set up monitoring (Railway provides built-in metrics)
4. 📌 Add more scraper sources (Phase 3)
5. 📌 Implement rate limiting
6. 📌 Add authentication for admin dashboard
7. 📌 Set up backup strategy for Supabase

---

## 🆘 SUPPORT

**Issues?** Open a GitHub issue: https://github.com/handsonnewfurniture-arch/handson-empire/issues

**Questions?** Contact: Tiger McBride (handsonmovers303@gmail.com)

---

**Built with ⚡ by Claude Code**

**Stack:** Node.js, Express, WebSocket, Supabase, Twilio, Vanilla JS
