// ══════════════════════════════════════════════════════════════════════════════
// HANDSON EMPIRE - TURBO BACKEND
// ══════════════════════════════════════════════════════════════════════════════
// Powers: Customer Platform, Worker Platform, Admin Command Center
// Features: Real-time WebSocket, AI scraping, Auto-SMS, Lead scoring
// ══════════════════════════════════════════════════════════════════════════════

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const twilio = require('twilio');
const WebSocket = require('ws');
const http = require('http');

// ═══ ROUTE IMPORTS ═══
const authRoutes = require('./routes/auth');
const jobsRoutes = require('./routes/jobs');
const paymentsRoutes = require('./routes/payments');
const portfolioRoutes = require('./routes/portfolio');
const uploadRoutes = require('./routes/upload');
const referralsRoutes = require('./routes/referrals');
const routerRoutes = require('./routes/router');
const commsRoutes = require('./routes/comms');

// ═══ SCRAPER IMPORT ═══
const scraper = require('./scraper-enhanced');

// ═══ CONFIGURATION ═══
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json());

// Serve admin dashboard (both /admin and /admin.html)
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});
app.get('/admin.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// Serve customer pages
app.use('/customer', express.static(path.join(__dirname, 'customer')));
app.get('/customer/', (req, res) => {
  res.sendFile(path.join(__dirname, 'customer', 'index.html'));
});

// Serve worker pages
app.use('/worker', express.static(path.join(__dirname, 'worker')));

// Explicit worker routes as fallback
app.get('/worker/signup.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'worker', 'signup.html'));
});
app.get('/worker/index.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'worker', 'index.html'));
});
app.get('/worker/', (req, res) => {
  res.sendFile(path.join(__dirname, 'worker', 'index.html'));
});

// Serve shared assets
app.use('/shared', express.static(path.join(__dirname, 'shared')));

// ═══ SUPABASE SETUP ═══
const supabase = createClient(
  process.env.SUPABASE_URL || 'https://hzcgpuctetpfmxisehhe.supabase.co',
  process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY
);

// ═══ TWILIO SETUP ═══
const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

const TWILIO_PHONE = process.env.TWILIO_PHONE || '+17744687657';

// ═══ WEBSOCKET CONNECTIONS ═══
const connections = new Set();

wss.on('connection', (ws) => {
  console.log('🔌 New WebSocket connection');
  connections.add(ws);

  ws.on('close', () => {
    connections.delete(ws);
    console.log('🔌 WebSocket disconnected');
  });
});

function broadcast(event, data) {
  const message = JSON.stringify({ event, data, timestamp: Date.now() });
  connections.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  });
}

// ═══ LEAD SCORING ENGINE ═══
function scoreLead(lead) {
  let score = 50; // Base score

  // Priority signals
  if (lead.phone) score += 15;
  if (lead.address) score += 10;
  if (lead.signal_type === 'DIRECT_AD') score += 20;
  if (lead.signal_type === 'STORM_DAMAGE') score += 25;
  if (lead.signal_type === 'EVICTION') score += 20;
  if (lead.signal_type === 'LIEN_SALE') score += 20;
  if (lead.urgency === 'immediate') score += 15;
  if (lead.revenue > 5000) score += 10;

  // Determine priority
  let priority = 'COLD';
  if (score >= 90) priority = 'CRITICAL';
  else if (score >= 75) priority = 'HOT';
  else if (score >= 60) priority = 'WARM';

  return { score, priority };
}

// ═══ AUTO-SMS WHEN CRITICAL LEADS DROP ═══
async function sendCriticalAlert(lead, worker) {
  if (!twilioClient) {
    console.log('⚠️ Twilio not configured - skipping SMS');
    return;
  }

  try {
    const message = `🚨 CRITICAL LEAD - ${lead.trade.toUpperCase()}\n\n${lead.title}\n${lead.city}, CO • $${lead.revenue.toLocaleString()}\nScore: ${lead.score}\n\nClaim now: https://worker.handson.ventures/lead/${lead.id}`;

    await twilioClient.messages.create({
      to: worker.phone,
      from: TWILIO_PHONE,
      body: message
    });

    console.log(`📱 SMS sent to ${worker.name} (${worker.phone})`);
  } catch (error) {
    console.error('SMS Error:', error);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// API ROUTES
// ═══════════════════════════════════════════════════════════════════════════

// ─── ROOT ───────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ name: 'HandsOn Empire API', status: 'TURBO', version: '1.0' });
});

// ─── HEALTH CHECK ────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'TURBO',
    websockets: connections.size,
    timestamp: Date.now()
  });
});

// ─── GET ALL LEADS ───────────────────────────────────────────────────────────
app.get('/api/leads', async (req, res) => {
  try {
    const { trade, priority, status } = req.query;

    let query = supabase.from('handson_leads').select('*');

    if (trade) query = query.eq('trade', trade);
    if (priority) query = query.eq('priority', priority);
    if (status) query = query.eq('status', status);

    const { data, error } = await query.order('signal_date', { ascending: false });

    if (error) throw error;

    res.json({ leads: data || [] });
  } catch (error) {
    console.error('Error fetching leads:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── CREATE LEAD ─────────────────────────────────────────────────────────────
app.post('/api/leads', async (req, res) => {
  try {
    const leadData = req.body;

    // Generate unique ID if not provided
    if (!leadData.id) {
      leadData.id = `lead-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    // Score the lead
    const { score, priority } = scoreLead(leadData);
    leadData.score = score;
    leadData.priority = priority;
    leadData.status = leadData.status || 'NEW';
    leadData.created_at = new Date().toISOString();

    // Insert into Supabase
    const { data, error } = await supabase
      .from('handson_leads')
      .insert([leadData])
      .select()
      .single();

    if (error) throw error;

    // Broadcast to all connected clients
    broadcast('NEW_LEAD', data);

    // If CRITICAL, send SMS to matched worker
    if (priority === 'CRITICAL') {
      const { data: workers } = await supabase
        .from('handson_workers')
        .select('*')
        .contains('trades', [leadData.trade])
        .eq('status', 'available')
        .limit(1)
        .single();

      if (workers) {
        await sendCriticalAlert(data, workers);
      }
    }

    console.log(`✅ New ${priority} lead created: ${leadData.title}`);

    res.json({ lead: data });
  } catch (error) {
    console.error('Error creating lead:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── CLAIM LEAD ──────────────────────────────────────────────────────────────
app.post('/api/leads/:id/claim', async (req, res) => {
  try {
    const { id } = req.params;
    const { worker_id } = req.body;

    const { data, error } = await supabase
      .from('handson_leads')
      .update({
        status: 'CLAIMED',
        claimed_by: worker_id,
        claimed_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    broadcast('LEAD_CLAIMED', data);

    res.json({ lead: data });
  } catch (error) {
    console.error('Error claiming lead:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── QUALIFY ALL LEADS ──────────────────────────────────────────────────────
// Runs all leads through the customer profile matching + scoring pipeline
const { processLeads, qualifyAndCategorize, CUSTOMER_PROFILES, LEAD_CATEGORIES } = require('./customer-profiles.js');

app.get('/api/leads/qualify', async (req, res) => {
  try {
    const { limit = 100 } = req.query;

    // Get leads
    const { data: leads, error } = await supabase
      .from('handson_leads')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (error) throw error;

    // Process through qualification pipeline
    const result = processLeads(leads);

    res.json({
      stats: result.stats,
      byCategory: {
        hot: result.byCategory.HOT_LEADS.length,
        warm: result.byCategory.WARM_LEADS.length,
        nurture: result.byCategory.NURTURE_LEADS.length,
        cold: result.byCategory.COLD_LEADS.length
      },
      byProfile: Object.fromEntries(
        Object.entries(result.byProfile).map(([k, v]) => [k, v.length])
      ),
      leads: result.qualified
    });
  } catch (error) {
    console.error('Error qualifying leads:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── GET CONTACT QUEUE (Priority order) ─────────────────────────────────────
app.get('/api/leads/queue', async (req, res) => {
  try {
    const { category = 'HOT_LEADS', limit = 20 } = req.query;

    // Get leads
    const { data: leads, error } = await supabase
      .from('handson_leads')
      .select('*')
      .neq('status', 'CLAIMED')
      .neq('status', 'CONTACTED')
      .neq('status', 'CLOSED')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    // Process and filter by category
    const result = processLeads(leads);
    const queue = result.byCategory[category] || [];

    res.json({
      category,
      total: queue.length,
      queue: queue.slice(0, parseInt(limit)).map(lead => ({
        id: lead.id,
        title: lead.title,
        score: lead.score,
        priority: lead.priority,
        customer_profile: lead.customer_profile,
        profile_tier: lead.profile_tier,
        expected_value: lead.expected_value,
        max_response_time: lead.max_response_time,
        phone: lead.phone,
        source: lead.source,
        created_at: lead.created_at
      }))
    });
  } catch (error) {
    console.error('Error getting queue:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── MARK LEAD AS CONTACTED ─────────────────────────────────────────────────
app.post('/api/leads/:id/contact', async (req, res) => {
  try {
    const { id } = req.params;
    const { notes, outcome } = req.body;

    const { data, error } = await supabase
      .from('handson_leads')
      .update({
        status: 'CONTACTED',
        notes: notes || '',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    broadcast('LEAD_CONTACTED', data);

    res.json({ lead: data });
  } catch (error) {
    console.error('Error marking contacted:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── GET CUSTOMER PROFILES ──────────────────────────────────────────────────
app.get('/api/profiles', (req, res) => {
  res.json({
    profiles: Object.values(CUSTOMER_PROFILES).map(p => ({
      id: p.id,
      name: p.name,
      tier: p.tier,
      description: p.description,
      avg_value: p.value.avg_job,
      close_rate: p.value.close_rate,
      max_response_time: p.contact.max_response_time
    })),
    categories: LEAD_CATEGORIES
  });
});

// ─── GET LEADS BY PROFILE ───────────────────────────────────────────────────
app.get('/api/leads/profile/:profileId', async (req, res) => {
  try {
    const { profileId } = req.params;
    const { limit = 50 } = req.query;

    // Get leads
    const { data: leads, error } = await supabase
      .from('handson_leads')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(parseInt(limit) * 2);

    if (error) throw error;

    // Process and filter by profile
    const result = processLeads(leads);
    const profileLeads = result.byProfile[profileId] || [];

    const profile = CUSTOMER_PROFILES[profileId.toUpperCase()];

    res.json({
      profile: profile ? {
        id: profile.id,
        name: profile.name,
        tier: profile.tier,
        description: profile.description,
        pain_points: profile.pain_points,
        value: profile.value
      } : null,
      total: profileLeads.length,
      leads: profileLeads.slice(0, parseInt(limit))
    });
  } catch (error) {
    console.error('Error getting profile leads:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── DASHBOARD STATS ────────────────────────────────────────────────────────
app.get('/api/dashboard', async (req, res) => {
  try {
    // Get all leads
    const { data: leads } = await supabase
      .from('handson_leads')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    // Process through qualification pipeline
    const result = processLeads(leads || []);

    // Get today's leads
    const today = new Date().toISOString().split('T')[0];
    const todayLeads = leads?.filter(l => l.created_at?.startsWith(today)) || [];

    res.json({
      overview: {
        total_leads: leads?.length || 0,
        today_leads: todayLeads.length,
        total_pipeline: result.stats.total_pipeline,
        avg_score: result.stats.avg_score
      },
      categories: {
        hot: result.byCategory.HOT_LEADS.length,
        warm: result.byCategory.WARM_LEADS.length,
        nurture: result.byCategory.NURTURE_LEADS.length,
        cold: result.byCategory.COLD_LEADS.length
      },
      profiles: Object.fromEntries(
        Object.entries(result.byProfile).map(([k, v]) => [k, v.length])
      ),
      action_items: {
        call_now: result.byCategory.HOT_LEADS.slice(0, 5).map(l => ({
          id: l.id,
          title: l.title?.substring(0, 50),
          profile: l.customer_profile,
          value: l.expected_value
        })),
        call_today: result.byCategory.WARM_LEADS.slice(0, 5).map(l => ({
          id: l.id,
          title: l.title?.substring(0, 50),
          profile: l.customer_profile,
          value: l.expected_value
        }))
      }
    });
  } catch (error) {
    console.error('Error getting dashboard:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── WORKER SIGN UP ─────────────────────────────────────────────────────────
app.post('/api/workers/signup', async (req, res) => {
  try {
    const { name, phone, email, trades, city, bio } = req.body;

    if (!name || !phone || !trades || trades.length === 0) {
      return res.status(400).json({ error: 'Name, phone, and at least one trade required' });
    }

    // Generate unique worker ID
    const workerId = `w-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

    const { data, error } = await supabase
      .from('handson_workers')
      .insert([{
        id: workerId,
        name,
        phone,
        email: email || null,
        trades,
        address: city || 'Denver',
        bio: bio || '',
        status: 'pending',
        rating: 5.0,
        jobs: 0,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;

    console.log(`👷 New worker signup: ${name} (${phone})`);
    res.json({ success: true, worker: data });
  } catch (error) {
    console.error('Error signing up worker:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── GET WORKERS ─────────────────────────────────────────────────────────────
app.get('/api/workers', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('handson_workers')
      .select('*')
      .order('rating', { ascending: false });

    if (error) throw error;

    res.json({ workers: data || [] });
  } catch (error) {
    console.error('Error fetching workers:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── MATCH CUSTOMER TO WORKER ────────────────────────────────────────────────
app.post('/api/match', async (req, res) => {
  try {
    const { trade, urgency } = req.body;

    // Find available workers for this trade
    const { data: workers, error } = await supabase
      .from('handson_workers')
      .select('*')
      .contains('trades', [trade])
      .eq('status', 'available')
      .order('rating', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    if (!workers) {
      // No available workers, find next best
      const { data: anyWorker } = await supabase
        .from('handson_workers')
        .select('*')
        .contains('trades', [trade])
        .order('rating', { ascending: false })
        .limit(1)
        .single();

      return res.json({ worker: anyWorker, available: false });
    }

    res.json({ worker: workers, available: true });
  } catch (error) {
    console.error('Error matching:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── SCRAPER ENDPOINTS ──────────────────────────────────────────────────────

// Track active scraper runs
let activeScraperRun = null;

// Run ALL scrapers (full 45+ source scan)
app.post('/api/scrape/all', async (req, res) => {
  try {
    if (activeScraperRun) {
      return res.json({
        success: false,
        message: 'Scraper already running',
        status: 'busy'
      });
    }

    console.log('🕷️ [API] Starting full scraper run...');
    activeScraperRun = 'all';

    // Broadcast scraper started
    broadcast('SCRAPER_STARTED', { source: 'all' });

    // Run asynchronously so we can return immediately
    scraper.runAllScrapers()
      .then(leads => {
        console.log(`✅ [API] Full scrape complete: ${leads.length} leads`);
        broadcast('SCRAPER_COMPLETE', {
          source: 'all',
          leads: leads.length,
          pipeline: leads.reduce((s, l) => s + (l.revenue || 0), 0)
        });
        activeScraperRun = null;
      })
      .catch(err => {
        console.error('❌ [API] Scraper error:', err.message);
        broadcast('SCRAPER_ERROR', { source: 'all', error: err.message });
        activeScraperRun = null;
      });

    res.json({
      success: true,
      message: 'Full scraper run started',
      status: 'running'
    });
  } catch (error) {
    activeScraperRun = null;
    res.status(500).json({ success: false, error: error.message });
  }
});

// Run specific scraper by source name
app.post('/api/scrape/:source', async (req, res) => {
  try {
    const { source } = req.params;
    const { city = 'denver', trade = 'movers' } = req.body;

    console.log(`🕷️ [API] Running scraper: ${source}`);
    broadcast('SCRAPER_STARTED', { source });

    let leads = [];

    // Map source names to scraper functions
    switch (source.toLowerCase()) {
      case 'craigslist':
        leads = await scraper.scrapeCraigslist(city, trade);
        break;
      case 'reddit':
        leads = await scraper.scrapeReddit('Denver');
        break;
      case 'redfin':
        leads = await scraper.scrapeRedfin(city, 'SOLD');
        break;
      case 'apartments':
        leads = await scraper.scrapeApartments(city);
        break;
      case 'zillow':
        leads = await scraper.scrapeZillow(city);
        break;
      case 'storage':
        leads = await scraper.scrapeStorageAuctions();
        break;
      case 'permits':
        leads = await scraper.scrapeCityPermits(city);
        break;
      case 'noaa':
        leads = await scraper.scrapeNOAA();
        break;
      case 'eviction':
        leads = await scraper.scrapeEvictionCourt();
        break;
      case 'university':
        leads = await scraper.scrapeUniversityHousing('CU Boulder');
        break;
      case 'nextdoor':
        leads = await scraper.scrapeNextdoor();
        break;
      case 'smartcity':
        leads = await scraper.scrapeSmartCity();
        break;
      case 'googlemaps':
        leads = await scraper.scrapeGoogleMapsBatch(city);
        break;
      default:
        return res.status(400).json({
          success: false,
          error: `Unknown scraper: ${source}`,
          available: ['craigslist', 'reddit', 'redfin', 'apartments', 'zillow', 'storage', 'permits', 'noaa', 'eviction', 'university', 'nextdoor', 'smartcity', 'googlemaps']
        });
    }

    // Deduplicate and save leads
    if (leads.length > 0) {
      const uniqueLeads = await scraper.deduplicateLeads(leads);
      if (uniqueLeads.length > 0) {
        const { error } = await supabase
          .from('handson_leads')
          .upsert(uniqueLeads, { onConflict: 'id' });

        if (error) console.error('Save error:', error);
      }

      broadcast('SCRAPER_COMPLETE', {
        source,
        leads: uniqueLeads.length,
        duplicates: leads.length - uniqueLeads.length
      });

      // Broadcast new leads individually
      uniqueLeads.forEach(lead => broadcast('NEW_LEAD', lead));

      res.json({
        success: true,
        source,
        leads: uniqueLeads.length,
        duplicates: leads.length - uniqueLeads.length,
        pipeline: uniqueLeads.reduce((s, l) => s + (l.revenue || 0), 0)
      });
    } else {
      broadcast('SCRAPER_COMPLETE', { source, leads: 0 });
      res.json({
        success: true,
        source,
        leads: 0,
        message: 'No new leads found'
      });
    }
  } catch (error) {
    console.error(`❌ [API] Scraper ${req.params.source} error:`, error.message);
    broadcast('SCRAPER_ERROR', { source: req.params.source, error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get scraper status
app.get('/api/scrape/status', (req, res) => {
  res.json({
    active: activeScraperRun,
    available: ['craigslist', 'reddit', 'redfin', 'apartments', 'zillow', 'storage', 'permits', 'noaa', 'eviction', 'university', 'nextdoor', 'smartcity', 'googlemaps']
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// REGISTER NEW ROUTES
// ═══════════════════════════════════════════════════════════════════════════

// Pass broadcast function to routes that need it
jobsRoutes.setBroadcast(broadcast);
paymentsRoutes.setBroadcast(broadcast);

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobsRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/referrals', referralsRoutes);
app.use('/api/router', routerRoutes);
console.log('✅ Router routes mounted');
app.use('/api/comms', commsRoutes);
console.log('✅ Comms routes mounted');

// Debug test endpoint
app.get('/api/test-routes', (req, res) => {
  res.json({
    status: 'ok',
    routes: ['router', 'comms', 'leads', 'jobs', 'auth'],
    timestamp: new Date().toISOString()
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// START SERVER
// ═══════════════════════════════════════════════════════════════════════════

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════════════════╗
║                      🚀 HANDSON EMPIRE - TURBO MODE 🚀                   ║
╠══════════════════════════════════════════════════════════════════════════╣
║  Server:      http://localhost:${PORT}                                      ║
║  WebSocket:   ws://localhost:${PORT}                                        ║
║  Supabase:    ${supabase ? '✅ Connected' : '❌ Not configured'}                                           ║
║  Twilio:      ${twilioClient ? '✅ Connected' : '❌ Not configured'}                                           ║
║  Connections: ${connections.size} active                                            ║
╚══════════════════════════════════════════════════════════════════════════╝
  `);
});
