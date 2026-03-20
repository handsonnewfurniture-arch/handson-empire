#!/bin/bash

# ══════════════════════════════════════════════════════════════════════════════
# HANDSON EMPIRE - ONE-COMMAND DEPLOYMENT
# ══════════════════════════════════════════════════════════════════════════════

set -e

echo "╔══════════════════════════════════════════════════════════════════════════╗"
echo "║              🚀 HANDSON EMPIRE - DEPLOYMENT SCRIPT 🚀                    ║"
echo "╚══════════════════════════════════════════════════════════════════════════╝"
echo ""

# Check if .env exists
if [ ! -f backend/.env ]; then
  echo "❌ Error: backend/.env not found!"
  echo "→ Copy backend/.env.example to backend/.env and fill in your keys"
  exit 1
fi

echo "✅ Environment file found"
echo ""

# Deploy backend to Railway
echo "📦 Deploying backend to Railway..."
cd backend
railway up
cd ..

echo ""
echo "✅ Backend deployed!"
echo ""

# Deploy customer platform to Netlify
echo "📦 Deploying customer platform..."
cd customer
netlify deploy --prod --dir=.
cd ..

echo ""
echo "✅ Customer platform deployed!"
echo ""

# Deploy worker platform to Netlify
echo "📦 Deploying worker platform..."
cd worker
netlify deploy --prod --dir=.
cd ..

echo ""
echo "✅ Worker platform deployed!"
echo ""

echo "╔══════════════════════════════════════════════════════════════════════════╗"
echo "║                     ✅ ALL PLATFORMS DEPLOYED!                           ║"
echo "╠══════════════════════════════════════════════════════════════════════════╣"
echo "║  Customer:  https://customer.handson.ventures                            ║"
echo "║  Worker:    https://worker.handson.ventures                              ║"
echo "║  Admin:     https://admin.handson.ventures                               ║"
echo "║  Backend:   https://handson-empire.up.railway.app                        ║"
echo "╚══════════════════════════════════════════════════════════════════════════╝"
echo ""
echo "🎯 Next steps:"
echo "1. Test customer platform (book a test job)"
echo "2. Test worker platform (claim a test lead)"
echo "3. Run scraper: cd backend && node scraper.js"
echo "4. Set up cron job for auto-scraping"
echo ""
echo "Done! 🚀"
