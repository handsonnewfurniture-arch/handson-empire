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

// ═══ CONFIGURATION ═══
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json());

// Serve admin dashboard
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
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

// ─── SCRAPER TRIGGER ─────────────────────────────────────────────────────────
app.post('/api/scrape', async (req, res) => {
  try {
    const { source } = req.body;

    // This would trigger your scraper
    console.log(`🕷️ Scraping ${source}...`);

    // For now, return mock data
    res.json({
      message: `Scraper triggered for ${source}`,
      status: 'running'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
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
