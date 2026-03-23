#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════════
// HANDSON EMPIRE - NATIONAL SCRAPER
// Scrapes leads across major US cities
// ══════════════════════════════════════════════════════════════════════════════

require('dotenv').config();
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const emailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

// Major US city subreddits to scrape
const CITIES = [
  // Colorado
  { sub: 'Denver', name: 'Denver, CO' },
  { sub: 'ColoradoSprings', name: 'Colorado Springs, CO' },
  { sub: 'boulder', name: 'Boulder, CO' },
  { sub: 'FortCollins', name: 'Fort Collins, CO' },
  // Texas
  { sub: 'Austin', name: 'Austin, TX' },
  { sub: 'Dallas', name: 'Dallas, TX' },
  { sub: 'houston', name: 'Houston, TX' },
  { sub: 'sanantonio', name: 'San Antonio, TX' },
  // California
  { sub: 'LosAngeles', name: 'Los Angeles, CA' },
  { sub: 'sanfrancisco', name: 'San Francisco, CA' },
  { sub: 'sandiego', name: 'San Diego, CA' },
  { sub: 'Sacramento', name: 'Sacramento, CA' },
  // East Coast
  { sub: 'nyc', name: 'New York, NY' },
  { sub: 'boston', name: 'Boston, MA' },
  { sub: 'philadelphia', name: 'Philadelphia, PA' },
  { sub: 'washingtondc', name: 'Washington, DC' },
  // Southeast
  { sub: 'Atlanta', name: 'Atlanta, GA' },
  { sub: 'Miami', name: 'Miami, FL' },
  { sub: 'Charlotte', name: 'Charlotte, NC' },
  { sub: 'nashville', name: 'Nashville, TN' },
  // Midwest
  { sub: 'chicago', name: 'Chicago, IL' },
  { sub: 'Minneapolis', name: 'Minneapolis, MN' },
  { sub: 'Detroit', name: 'Detroit, MI' },
  { sub: 'Columbus', name: 'Columbus, OH' },
  // Southwest
  { sub: 'phoenix', name: 'Phoenix, AZ' },
  { sub: 'vegas', name: 'Las Vegas, NV' },
  { sub: 'Albuquerque', name: 'Albuquerque, NM' },
  { sub: 'Tucson', name: 'Tucson, AZ' },
  // Northwest
  { sub: 'Seattle', name: 'Seattle, WA' },
  { sub: 'Portland', name: 'Portland, OR' },
  { sub: 'SaltLakeCity', name: 'Salt Lake City, UT' }
];

const VALID_KEYWORDS = [
  'furniture', 'pickup', 'moving', 'assembly', 'haul', 'couch', 'sofa',
  'desk', 'ikea', 'wayfair', 'delivery', 'handyman', 'movers', 'help moving',
  'need help', 'free couch', 'curb alert'
];

const SEARCH_QUERIES = [
  'furniture pickup',
  'moving help',
  'need movers',
  'ikea assembly',
  'free furniture',
  'curb alert',
  'handyman recommendations'
];

async function scrapeCity(city) {
  const leads = [];

  for (const query of SEARCH_QUERIES) {
    try {
      const url = `https://www.reddit.com/r/${city.sub}/search.json?q=${encodeURIComponent(query)}&restrict_sr=1&sort=new&t=week&limit=5`;

      const { data } = await axios.get(url, {
        headers: { 'User-Agent': 'HandsOnNational/1.0' },
        timeout: 8000
      });

      const posts = data?.data?.children || [];

      for (const post of posts) {
        const { title, selftext, permalink, id: postId, created_utc } = post.data;
        const text = (title + ' ' + (selftext || '')).toLowerCase();

        // Must have valid keyword
        const hasValidKeyword = VALID_KEYWORDS.some(k => text.includes(k));
        if (!hasValidKeyword) continue;

        // Skip duplicates
        if (leads.find(l => l.id === 'nat-' + postId)) continue;

        const isUrgent = text.includes('asap') || text.includes('today') || text.includes('urgent') || text.includes('need help') || text.includes('looking for');
        const isMoving = text.includes('mov') || text.includes('relocat');

        leads.push({
          id: 'nat-' + postId,
          trade: isMoving ? 'moving' : 'assembly',
          source: `Reddit r/${city.sub}`,
          signal_type: 'OPPORTUNITY',
          title: title.substring(0, 150),
          city: city.name,
          state: 'US',
          signal_date: new Date(created_utc * 1000).toISOString().split('T')[0],
          status: 'NEW',
          score: isUrgent ? 95 : 80,
          priority: isUrgent ? 'CRITICAL' : 'HOT',
          urgency: isUrgent ? 'immediate' : 'this_week',
          revenue: isMoving ? 300 : 150,
          signals: ['NATIONAL', 'OPPORTUNITY'],
          notes: (selftext || '').substring(0, 150),
          link: 'https://reddit.com' + permalink,
          sms: `Hi! Saw your post. We do ${isMoving ? 'moving help' : 'furniture assembly'} - fast & reliable. Text for quote!`
        });
      }
    } catch (e) {
      // Skip failed requests silently
    }

    // Rate limiting
    await new Promise(r => setTimeout(r, 300));
  }

  return leads;
}

async function runNationalScrape() {
  console.log(`
╔══════════════════════════════════════════════════════════════════════════╗
║          🇺🇸  HANDSON NATIONAL SCRAPER                                    ║
║          Scanning ${CITIES.length} major US cities                                    ║
╚══════════════════════════════════════════════════════════════════════════╝
`);

  const allLeads = [];
  let citiesWithLeads = 0;

  for (const city of CITIES) {
    process.stdout.write(`  📍 ${city.name.padEnd(25)} `);
    const leads = await scrapeCity(city);
    allLeads.push(...leads);

    if (leads.length > 0) {
      console.log(`✅ ${leads.length} leads`);
      citiesWithLeads++;
    } else {
      console.log(`-`);
    }
  }

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  📊 RESULTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Total leads:     ${allLeads.length}
  Cities with leads: ${citiesWithLeads}/${CITIES.length}
  CRITICAL:        ${allLeads.filter(l => l.priority === 'CRITICAL').length}
  HOT:             ${allLeads.filter(l => l.priority === 'HOT').length}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

  if (allLeads.length > 0) {
    // Save to Supabase
    const { error } = await supabase.from('handson_leads').upsert(allLeads);
    if (error) {
      console.log('❌ Save error:', error.message);
    } else {
      console.log('✅ Saved to database');
    }

    // Show top CRITICAL leads
    const critical = allLeads.filter(l => l.priority === 'CRITICAL');
    if (critical.length > 0) {
      console.log('\n🔥 TOP CRITICAL LEADS:');
      critical.slice(0, 10).forEach(l => {
        console.log(`  • [${l.city}] ${l.title.substring(0, 55)}...`);
        console.log(`    🔗 ${l.link}`);
      });
    }

    // Email summary
    try {
      await emailTransporter.sendMail({
        from: process.env.EMAIL_USER,
        to: process.env.ALERT_EMAIL,
        subject: `🇺🇸 National Scrape: ${allLeads.length} leads (${critical.length} critical)`,
        html: `
          <div style="font-family: sans-serif; padding: 20px; background: #1a1a2e; color: #eee; border-radius: 12px;">
            <h1 style="color: #f97316;">🇺🇸 National Scrape Complete</h1>
            <p>Found <strong>${allLeads.length}</strong> leads across <strong>${citiesWithLeads}</strong> cities</p>
            <p style="color: #ef4444;"><strong>CRITICAL: ${critical.length}</strong></p>
            <p style="color: #f97316;"><strong>HOT: ${allLeads.filter(l => l.priority === 'HOT').length}</strong></p>

            ${critical.length > 0 ? `
            <h2 style="color: #ef4444;">🔥 Critical Leads:</h2>
            <ul>
              ${critical.slice(0, 5).map(l => `<li><strong>${l.city}</strong>: ${l.title.substring(0, 60)}... <a href="${l.link}" style="color: #60a5fa;">View →</a></li>`).join('')}
            </ul>
            ` : ''}

            <a href="http://localhost:3000" style="display: inline-block; background: #f97316; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 16px;">Open Dashboard →</a>
          </div>
        `
      });
      console.log('\n📧 Email summary sent!');
    } catch (e) {
      console.log('Email error:', e.message);
    }
  }

  return allLeads;
}

// Run if called directly
if (require.main === module) {
  runNationalScrape();
}

module.exports = { runNationalScrape, CITIES };
