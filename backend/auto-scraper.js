#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════════
// HANDSON EMPIRE - AUTO SCRAPER
// Runs every 30 minutes, finds opportunity leads, emails CRITICAL ones
// ══════════════════════════════════════════════════════════════════════════════

require('dotenv').config();
const axios = require('axios');
const cheerio = require('cheerio');
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');

// Config
const SCRAPE_INTERVAL = 30 * 60 * 1000; // 30 minutes
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// Email setup
const emailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Opportunity keywords
const OPPORTUNITY_KEYWORDS = {
  furniture_buy: ['ikea', 'wayfair', 'desk', 'bed frame', 'dresser', 'bookshelf', 'couch', 'sofa', 'sectional', 'dining table'],
  moving: ['just moved', 'new apartment', 'moving to denver', 'relocating', 'new place', 'first apartment', 'move in'],
  pickup: ['pickup only', 'must pick up', 'you haul', 'curb alert', 'free if you haul', 'free couch', 'free furniture'],
  direct_request: ['need help', 'looking for', 'anyone know', 'recommendations', 'furniture pickup', 'moving help', 'assembly']
};

async function scrapeOpportunities() {
  console.log(`\n🔍 [${new Date().toLocaleTimeString()}] Scanning for opportunities...`);
  const leads = [];

  const searches = [
    { sub: 'Denver', query: 'moving help OR furniture pickup OR handyman', type: 'direct_request' },
    { sub: 'Denver', query: 'new apartment OR just moved', type: 'moving' },
    { sub: 'denverlist', query: 'furniture OR free OR pickup', type: 'furniture_buy' },
    { sub: 'Denver', query: 'ikea OR wayfair', type: 'furniture_buy' },
  ];

  for (const search of searches) {
    try {
      const url = `https://www.reddit.com/r/${search.sub}/search.json?q=${encodeURIComponent(search.query)}&restrict_sr=1&sort=new&t=day&limit=10`;
      const { data } = await axios.get(url, {
        headers: { 'User-Agent': 'HandsOnLeads/1.0' },
        timeout: 10000
      });

      const posts = data?.data?.children || [];

      for (const post of posts) {
        const { title, selftext, permalink, created_utc, id: postId } = post.data;
        const text = `${title} ${selftext || ''}`.toLowerCase();

        // Check for opportunity signals
        let matchType = null;
        let priority = 'WARM';
        let score = 70;

        for (const [type, keywords] of Object.entries(OPPORTUNITY_KEYWORDS)) {
          if (keywords.some(kw => text.includes(kw))) {
            matchType = type;
            if (type === 'direct_request') {
              priority = 'CRITICAL';
              score = 95;
            } else if (type === 'pickup') {
              priority = 'HOT';
              score = 85;
            }
            break;
          }
        }

        if (matchType) {
          // Check if already exists
          const { data: existing } = await supabase
            .from('handson_leads')
            .select('id')
            .eq('id', `opp-${postId}`)
            .single();

          if (!existing) {
            const service = matchType === 'moving' ? 'moving' : 'assembly';
            const lead = {
              id: `opp-${postId}`,
              trade: service,
              source: `Reddit r/${search.sub}`,
              signal_type: 'OPPORTUNITY',
              title: title.substring(0, 150),
              city: 'Denver',
              state: 'CO',
              signal_date: new Date(created_utc * 1000).toISOString().split('T')[0],
              status: 'NEW',
              score,
              priority,
              urgency: priority === 'CRITICAL' ? 'immediate' : 'this_week',
              revenue: service === 'moving' ? 250 : 150,
              signals: ['OPPORTUNITY', matchType.toUpperCase()],
              notes: `${matchType.toUpperCase()} signal. ${selftext?.substring(0, 100) || ''}`,
              link: `https://reddit.com${permalink}`,
              sms: `Hi! Saw your post. HandsOn does ${service} in Denver - fast, reliable, fair prices. (720) 899-0383`
            };

            leads.push(lead);
          }
        }
      }

      await new Promise(r => setTimeout(r, 500));
    } catch (e) {
      console.log(`  ⚠️ ${search.sub}: ${e.message}`);
    }
  }

  return leads;
}

async function saveAndAlert(leads) {
  if (leads.length === 0) {
    console.log('   No new leads found');
    return;
  }

  // Save to Supabase
  const { error } = await supabase.from('handson_leads').upsert(leads);
  if (error) {
    console.log('   ❌ Save error:', error.message);
    return;
  }

  console.log(`   ✅ Saved ${leads.length} new leads`);

  // Email CRITICAL leads
  const criticalLeads = leads.filter(l => l.priority === 'CRITICAL' || l.priority === 'HOT');

  if (criticalLeads.length > 0) {
    console.log(`   📧 Emailing ${criticalLeads.length} hot leads...`);

    for (const lead of criticalLeads) {
      try {
        await emailTransporter.sendMail({
          from: process.env.EMAIL_USER,
          to: process.env.ALERT_EMAIL,
          subject: `🔥 ${lead.priority}: ${lead.trade.toUpperCase()} Lead - ${lead.title.substring(0, 50)}`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; padding: 20px; background: #1a1a2e; color: #eee; border-radius: 12px;">
              <h1 style="color: #f97316; margin: 0 0 16px 0;">🔥 ${lead.priority} LEAD</h1>
              <h2 style="margin: 0 0 8px 0; color: #fff;">${lead.title}</h2>
              <p style="color: #888; margin: 0 0 16px 0;">${lead.source}</p>

              <div style="background: #2a2a4a; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
                <p style="margin: 0;"><strong>Service:</strong> ${lead.trade}</p>
                <p style="margin: 8px 0 0 0;"><strong>Est. Value:</strong> $${lead.revenue}</p>
              </div>

              <a href="${lead.link}" style="display: inline-block; background: #f97316; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">View Post & Reply →</a>

              <div style="margin-top: 20px; padding: 12px; background: #2a2a4a; border-radius: 8px;">
                <p style="margin: 0 0 8px 0; font-size: 12px; color: #888;">📱 Ready SMS:</p>
                <p style="margin: 0; color: #ccc;">${lead.sms}</p>
              </div>
            </div>
          `
        });
        console.log(`      ✅ Emailed: ${lead.title.substring(0, 40)}...`);
      } catch (e) {
        console.log(`      ❌ Email failed: ${e.message}`);
      }
    }
  }
}

async function runScrape() {
  const leads = await scrapeOpportunities();
  await saveAndAlert(leads);
}

// Nextdoor parser
const { checkEmails: checkNextdoor } = require('./nextdoor-parser.js');

// National scraper
const { runNationalScrape } = require('./national-scraper.js');
const NATIONAL_INTERVAL = 4 * 60 * 60 * 1000; // Every 4 hours

async function runNextdoorScan() {
  console.log(`\n🏘️ [${new Date().toLocaleTimeString()}] Checking Nextdoor emails...`);
  try {
    const leads = await checkNextdoor();
    if (leads.length > 0) {
      console.log(`   ✅ Found ${leads.length} Nextdoor leads`);
    }
  } catch (e) {
    console.log(`   ⚠️ Nextdoor: ${e.message}`);
  }
}

// Main loop
console.log(`
╔══════════════════════════════════════════════════════════════════════════╗
║            🤖 HANDSON AUTO-SCRAPER - RUNNING                             ║
║            Local scan: Every 30 minutes (Reddit, Nextdoor)               ║
║            National scan: Every 4 hours (31 US cities)                   ║
║            CRITICAL leads will be emailed to you                         ║
╚══════════════════════════════════════════════════════════════════════════╝
`);

// Run local scrape immediately
runScrape();
runNextdoorScan();

// Run national scrape on startup too
console.log('\n🇺🇸 Running initial national scan...');
runNationalScrape().catch(e => console.log('National scan error:', e.message));

// Local scrape every 30 minutes
setInterval(() => {
  runScrape();
  runNextdoorScan();
}, SCRAPE_INTERVAL);

// National scrape every 4 hours
setInterval(() => {
  console.log('\n🇺🇸 Running scheduled national scan...');
  runNationalScrape().catch(e => console.log('National scan error:', e.message));
}, NATIONAL_INTERVAL);

console.log('⏰ Local scan: every 30 min | National scan: every 4 hours\n');
console.log('Press Ctrl+C to stop.\n');
