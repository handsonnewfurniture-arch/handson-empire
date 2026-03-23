#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════════
// HANDSON EMPIRE - NEXTDOOR EMAIL PARSER
// Reads Nextdoor digest emails from Gmail and extracts leads
// ══════════════════════════════════════════════════════════════════════════════

require('dotenv').config();
const Imap = require('imap');
const { simpleParser } = require('mailparser');
const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// Email transporter for alerts
const emailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

// Keywords that indicate someone needs services
const SERVICE_KEYWORDS = {
  assembly: ['furniture assembly', 'assemble', 'ikea', 'wayfair', 'put together', 'build furniture'],
  moving: ['moving help', 'need movers', 'help moving', 'moving truck', 'loading help', 'unloading'],
  delivery: ['pickup', 'deliver', 'haul', 'transport'],
  handyman: ['handyman', 'mount tv', 'hang', 'install', 'fix', 'repair', 'odd jobs']
};

const INTENT_SIGNALS = [
  'looking for', 'need', 'anyone know', 'recommend', 'suggestions',
  'who do you use', 'help', 'hire', 'available', 'asap'
];

// IMAP config for Gmail
const imapConfig = {
  user: process.env.EMAIL_USER,
  password: process.env.EMAIL_PASS,
  host: 'imap.gmail.com',
  port: 993,
  tls: true,
  tlsOptions: { rejectUnauthorized: false }
};

function parseNextdoorEmail(emailText, emailHtml) {
  const leads = [];
  const text = (emailText || '').toLowerCase();
  const html = (emailHtml || '').toLowerCase();
  const content = text + ' ' + html;

  // Look for posts that match our services
  // Nextdoor emails usually have sections like "Posts from your neighborhood"

  // Extract individual posts (they're usually separated by dividers or in list items)
  const postPatterns = [
    /<td[^>]*>([^<]{20,300})<\/td>/gi,  // Table cells with content
    /<p[^>]*>([^<]{20,300})<\/p>/gi,     // Paragraphs
    /<div[^>]*>([^<]{20,300})<\/div>/gi  // Divs
  ];

  const extractedPosts = new Set();

  for (const pattern of postPatterns) {
    let match;
    const tempHtml = emailHtml || '';
    while ((match = pattern.exec(tempHtml)) !== null) {
      const postText = match[1].replace(/<[^>]*>/g, '').trim();
      if (postText.length > 30 && postText.length < 300) {
        extractedPosts.add(postText);
      }
    }
  }

  // Also split by common separators
  const textPosts = text.split(/\n\n|\r\n\r\n|---/).filter(p => p.length > 30 && p.length < 500);
  textPosts.forEach(p => extractedPosts.add(p.trim()));

  // Check each potential post for service keywords + intent
  for (const post of extractedPosts) {
    const postLower = post.toLowerCase();

    // Must have intent signal
    const hasIntent = INTENT_SIGNALS.some(sig => postLower.includes(sig));
    if (!hasIntent) continue;

    // Check which service matches
    let matchedService = null;
    for (const [service, keywords] of Object.entries(SERVICE_KEYWORDS)) {
      if (keywords.some(kw => postLower.includes(kw))) {
        matchedService = service;
        break;
      }
    }

    // Also check for general furniture/moving mentions with intent
    if (!matchedService) {
      if (postLower.includes('furniture') || postLower.includes('couch') || postLower.includes('sofa')) {
        matchedService = 'assembly';
      } else if (postLower.includes('mov')) {
        matchedService = 'moving';
      }
    }

    if (matchedService) {
      leads.push({
        title: post.substring(0, 150),
        service: matchedService,
        text: post
      });
    }
  }

  return leads;
}

async function processEmail(email) {
  const parsed = await simpleParser(email);

  // Check if it's from Nextdoor
  const from = (parsed.from?.text || '').toLowerCase();
  const subject = (parsed.subject || '').toLowerCase();

  if (!from.includes('nextdoor') && !subject.includes('nextdoor')) {
    return [];
  }

  console.log(`📧 Processing Nextdoor email: ${parsed.subject}`);

  const leads = parseNextdoorEmail(parsed.text, parsed.html);
  return leads;
}

async function saveLeads(leads) {
  if (leads.length === 0) return;

  const dbLeads = leads.map((lead, i) => ({
    id: `nextdoor-${Date.now()}-${i}`,
    trade: lead.service,
    source: 'Nextdoor',
    signal_type: 'NEIGHBORHOOD_REQUEST',
    title: lead.title,
    city: 'Denver',
    state: 'CO',
    signal_date: new Date().toISOString().split('T')[0],
    status: 'NEW',
    score: 90,
    priority: 'CRITICAL',  // Nextdoor leads are high intent
    urgency: 'immediate',
    revenue: lead.service === 'moving' ? 250 : 150,
    signals: ['NEXTDOOR', 'LOCAL_REQUEST'],
    notes: lead.text.substring(0, 200),
    link: 'https://nextdoor.com',
    sms: `Hi neighbor! Saw your Nextdoor post. HandsOn does ${lead.service} in your area - fast, reliable, fair prices. (720) 899-0383`
  }));

  const { error } = await supabase.from('handson_leads').upsert(dbLeads);
  if (error) {
    console.log('❌ Save error:', error.message);
    return;
  }

  console.log(`✅ Saved ${dbLeads.length} Nextdoor leads`);

  // Email alert for each lead
  for (const lead of dbLeads) {
    try {
      await emailTransporter.sendMail({
        from: process.env.EMAIL_USER,
        to: process.env.ALERT_EMAIL,
        subject: `🏘️ NEXTDOOR: ${lead.trade.toUpperCase()} - "${lead.title.substring(0, 40)}..."`,
        html: `
          <div style="font-family: sans-serif; padding: 20px; background: #1a1a2e; color: #eee; border-radius: 12px;">
            <h1 style="color: #22c55e;">🏘️ Nextdoor Lead</h1>
            <h2 style="color: #fff;">${lead.title}</h2>
            <p><strong>Service:</strong> ${lead.trade}</p>
            <p><strong>Value:</strong> $${lead.revenue}</p>
            <div style="background: #2a2a4a; padding: 12px; border-radius: 8px; margin: 16px 0;">
              <p style="margin: 0;">${lead.notes}</p>
            </div>
            <a href="https://nextdoor.com" style="display: inline-block; background: #22c55e; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none;">Open Nextdoor & Reply →</a>
          </div>
        `
      });
      console.log(`📧 Alerted: ${lead.title.substring(0, 40)}...`);
    } catch (e) {
      console.log('Email error:', e.message);
    }
  }
}

async function checkEmails() {
  return new Promise((resolve, reject) => {
    const imap = new Imap(imapConfig);

    imap.once('ready', () => {
      imap.openBox('INBOX', false, (err, box) => {
        if (err) {
          reject(err);
          return;
        }

        // Search for unread Nextdoor emails from last 7 days
        const since = new Date();
        since.setDate(since.getDate() - 7);

        imap.search([
          ['SINCE', since],
          ['OR', ['FROM', 'nextdoor'], ['SUBJECT', 'nextdoor']]
        ], (err, results) => {
          if (err || !results || results.length === 0) {
            console.log('📭 No Nextdoor emails found');
            imap.end();
            resolve([]);
            return;
          }

          console.log(`📬 Found ${results.length} Nextdoor emails`);

          const allLeads = [];
          let processed = 0;

          const fetch = imap.fetch(results.slice(-10), { bodies: '' }); // Last 10 emails

          fetch.on('message', (msg) => {
            msg.on('body', async (stream) => {
              let buffer = '';
              stream.on('data', (chunk) => buffer += chunk.toString('utf8'));
              stream.on('end', async () => {
                try {
                  const leads = await processEmail(buffer);
                  allLeads.push(...leads);
                } catch (e) {
                  console.log('Parse error:', e.message);
                }
                processed++;
              });
            });
          });

          fetch.once('end', () => {
            setTimeout(() => {
              imap.end();
              resolve(allLeads);
            }, 2000);
          });
        });
      });
    });

    imap.once('error', (err) => {
      console.log('IMAP error:', err.message);
      reject(err);
    });

    imap.connect();
  });
}

async function run() {
  console.log(`
╔══════════════════════════════════════════════════════════════════════════╗
║          🏘️  NEXTDOOR EMAIL PARSER                                       ║
║          Extracting leads from Nextdoor digest emails                    ║
╚══════════════════════════════════════════════════════════════════════════╝
`);

  try {
    const leads = await checkEmails();
    if (leads.length > 0) {
      await saveLeads(leads);
    } else {
      console.log('💡 Tip: Make sure you have Nextdoor email digests enabled');
      console.log('   Go to Nextdoor → Settings → Email Preferences');
    }
  } catch (e) {
    console.log('❌ Error:', e.message);
    console.log('\n💡 Make sure:');
    console.log('   1. EMAIL_USER and EMAIL_PASS are set in .env');
    console.log('   2. You have Nextdoor emails in your inbox');
    console.log('   3. IMAP is enabled in Gmail settings');
  }
}

// Run if called directly
if (require.main === module) {
  run();
}

module.exports = { checkEmails, parseNextdoorEmail };
