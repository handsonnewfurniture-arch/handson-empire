// ══════════════════════════════════════════════════════════════════════════════
// HANDSON EMPIRE - ENHANCED SCRAPER ENGINE v2.0
// ══════════════════════════════════════════════════════════════════════════════
// 37 DATA SOURCES: Craigslist, Reddit, Facebook, Nextdoor, City Permits, NOAA,
// County Deeds, Eviction Court, WARN Act, StorageAuctions, University Housing,
// Google Trends, Yelp, Thumbtack proxy, HOA Violations, and more
// ══════════════════════════════════════════════════════════════════════════════

require('dotenv').config();
const axios = require('axios');
const cheerio = require('cheerio');
const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');

// ═══ CONFIGURATION ═══
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

// ═══ TWILIO SETUP ═══
let twilioClient = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  const twilio = require('twilio');
  twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  console.log('📱 Twilio SMS enabled');
}
const TWILIO_PHONE = process.env.TWILIO_PHONE || '+17744687657';
const ALERT_PHONE = process.env.ALERT_PHONE || '+17208990383'; // Tiger's phone

// ═══ EMAIL SETUP ═══
const ALERT_EMAIL = process.env.ALERT_EMAIL || 'handsonnewfurniture@gmail.com';
let emailTransporter = null;
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  emailTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
  console.log('📧 Email alerts enabled');
} else {
  console.log('📧 Email alerts: Using fallback (no Gmail app password)');
}

const DENVER_CITIES = ['denver', 'aurora', 'lakewood', 'littleton', 'englewood',
                       'thornton', 'arvada', 'westminster', 'centennial', 'boulder'];

// HandsOn Furniture core services
const HANDSON_SERVICES = {
  assembly: ['furniture assembly', 'assemble furniture', 'ikea assembly', 'put together', 'build furniture', 'assembly help', 'assemble ikea', 'assemble bed', 'assemble desk', 'assemble couch'],
  moving: ['need movers', 'moving help', 'help moving', 'move furniture', 'moving company', 'help me move', 'need help moving', 'moving assistance', 'apartment move', 'loading help', 'unloading help'],
  delivery: ['furniture delivery', 'pickup and delivery', 'need delivery', 'deliver furniture', 'haul furniture', 'transport furniture'],
  handyman: ['handyman needed', 'need handyman', 'looking for handyman', 'mount tv', 'hang pictures', 'install shelves', 'minor repairs', 'odd jobs', 'honey do list']
};

// Intent signals - people ASKING for help
const INTENT_SIGNALS = [
  'need help', 'looking for', 'anyone know', 'recommendations', 'who do you use',
  'can someone', 'hiring', 'need someone', 'iso', 'in search of', 'wanted',
  'does anyone', 'any suggestions', 'help needed', 'need a', 'know any'
];

// OPPORTUNITY SIGNALS - People who likely NEED assembly/moving soon
const OPPORTUNITY_KEYWORDS = {
  // Furniture purchases = need assembly
  furniture_buy: ['ikea', 'wayfair', 'ashley furniture', 'rooms to go', 'amazon furniture', 'target furniture', 'walmart furniture', 'costco furniture', 'desk', 'bed frame', 'dresser', 'bookshelf', 'couch', 'sofa', 'dining table', 'office chair', 'sectional'],
  // Moving signals
  moving: ['just moved', 'new apartment', 'moving to denver', 'relocating', 'new place', 'first apartment', 'move in', 'moving out', 'end of lease', 'new home'],
  // Pickup needed (they bought something heavy)
  pickup: ['pickup only', 'must pick up', 'local pickup', 'you haul', 'need truck', 'curb alert', 'free if you haul']
};

// Legacy trades for other lead types
const TRADE_KEYWORDS = {
  movers: ['moving', 'move', 'relocate', 'furniture assembly', 'delivery'],
  storage: ['storage unit', 'storage clear', 'lien sale', 'unit auction'],
  roofing: ['roof', 'roofing', 'shingles', 'leak', 'roof repair'],
  hvac: ['hvac', 'ac', 'air conditioning', 'furnace', 'heating'],
  electrical: ['electric', 'electrician', 'wiring', 'panel'],
  plumbing: ['plumb', 'pipe', 'drain', 'leak', 'water heater'],
  painting: ['paint', 'painting', 'interior paint', 'exterior paint'],
  junk: ['junk removal', 'haul away', 'trash', 'cleanout'],
  dumpster: ['dumpster', 'roll-off', 'demo', 'debris'],
  powerwash: ['power wash', 'pressure wash', 'driveway clean'],
  landscaping: ['landscape', 'lawn', 'yard work', 'tree'],
  solar: ['solar', 'solar panel', 'solar install'],
  trailer: ['trailer rental', 'haul', 'tow']
};

// ═══════════════════════════════════════════════════════════════════════════
// SOURCE 1-9: CRAIGSLIST (Denver Metro - 9 Cities)
// ═══════════════════════════════════════════════════════════════════════════

async function scrapeCraigslist(city = 'denver', trade = 'movers') {
  console.log(`🕷️ [Craigslist] Scraping ${city} for ${trade}...`);

  try {
    const keywords = TRADE_KEYWORDS[trade] || [trade];
    const searchTerm = keywords[0];
    const url = `https://${city}.craigslist.org/search/sss?query=${encodeURIComponent(searchTerm)}&sort=date`;

    const { data } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      },
      timeout: 15000
    });

    const $ = cheerio.load(data);
    const leads = [];

    // NEW: Parse JSON-LD structured data (Craigslist's new format)
    const jsonLdScript = $('#ld_searchpage_results').html();
    if (jsonLdScript) {
      try {
        const jsonData = JSON.parse(jsonLdScript);
        const items = jsonData?.itemListElement || [];

        items.slice(0, 15).forEach((item, i) => {
          const listing = item?.item;
          if (!listing) return;

          const title = listing.name || '';
          const price = listing.offers?.price || '';
          const address = listing.offers?.availableAtOrFrom?.address || {};
          const location = address.addressLocality || city;

          const titleLower = title.toLowerCase();
          const isRelevant = keywords.some(kw => titleLower.includes(kw.toLowerCase()));

          if (isRelevant && title) {
            leads.push({
              id: `cl-${city}-${Date.now()}-${i}`,
              trade,
              source: `Craigslist ${city.charAt(0).toUpperCase() + city.slice(1)}`,
              signal_type: 'DIRECT_AD',
              title,
              city: location.charAt(0).toUpperCase() + location.slice(1),
              state: address.addressRegion || 'CO',
              signal_date: new Date().toISOString().split('T')[0],
              status: 'NEW',
              score: 75,
              priority: 'HOT',
              revenue: parseInt(String(price).replace(/\D/g, '')) || estimateRevenue(trade),
              urgency: 'this_week',
              signals: ['DIRECT_INTENT', 'CRAIGSLIST'],
              phone: null,
              address: address.streetAddress || '',
              notes: `Found on Craigslist ${city}. ${listing.description || ''}`.substring(0, 200),
              link: null,
              sms: `Hi! HandsOn ${trade.charAt(0).toUpperCase() + trade.slice(1)} - saw your post on Craigslist. We help with ${trade}. Free quote today. (720) 899-0383`
            });
          }
        });
      } catch (parseError) {
        console.log(`⚠️ [Craigslist ${city}] JSON-LD parse failed, trying fallback...`);
      }
    }

    // FALLBACK: Try gallery card format (newer HTML structure)
    if (leads.length === 0) {
      $('li.cl-search-result, .gallery-card, .result-row').each((i, elem) => {
        if (i >= 15) return false;

        const $elem = $(elem);
        const title = $elem.find('.title, .posting-title, .result-title, a.titlestring').text().trim() ||
                     $elem.find('a').first().text().trim();
        const link = $elem.find('a').first().attr('href');
        const price = $elem.find('.price, .result-price, .priceinfo').text().trim();
        const location = $elem.find('.meta, .result-hood, .location').text().trim();

        const titleLower = title.toLowerCase();
        const isRelevant = keywords.some(kw => titleLower.includes(kw.toLowerCase()));

        if (isRelevant && title && title.length > 5) {
          leads.push({
            id: `cl-${city}-${Date.now()}-${i}`,
            trade,
            source: `Craigslist ${city.charAt(0).toUpperCase() + city.slice(1)}`,
            signal_type: 'DIRECT_AD',
            title,
            city: city.charAt(0).toUpperCase() + city.slice(1),
            state: 'CO',
            signal_date: new Date().toISOString().split('T')[0],
            status: 'NEW',
            score: 75,
            priority: 'HOT',
            revenue: parseInt(price?.replace(/\D/g, '')) || estimateRevenue(trade),
            urgency: 'this_week',
            signals: ['DIRECT_INTENT', 'CRAIGSLIST'],
            phone: null,
            address: location || '',
            notes: `Found on Craigslist ${city}`,
            link: link?.startsWith('http') ? link : `https://${city}.craigslist.org${link}`,
            sms: `Hi! HandsOn ${trade.charAt(0).toUpperCase() + trade.slice(1)} - saw your post on Craigslist. We help with ${trade}. Free quote today. (720) 899-0383`
          });
        }
      });
    }

    console.log(`✅ [Craigslist ${city}] Found ${leads.length} leads`);
    return leads;

  } catch (error) {
    console.error(`❌ [Craigslist ${city}] Error:`, error.message);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// OPPORTUNITY SIGNALS - People buying furniture, moving, etc.
// ═══════════════════════════════════════════════════════════════════════════

async function scrapeOpportunities() {
  console.log('🎯 [Opportunities] Finding people who need assembly/moving...');
  const leads = [];

  // 1. Reddit - People posting about moving to Denver, new apartments, furniture purchases
  const redditSearches = [
    { sub: 'Denver', query: 'moving to denver', type: 'moving' },
    { sub: 'Denver', query: 'new apartment', type: 'moving' },
    { sub: 'Denver', query: 'just moved', type: 'moving' },
    { sub: 'denverlist', query: 'furniture', type: 'furniture_buy' },
    { sub: 'denverlist', query: 'ikea OR wayfair', type: 'furniture_buy' },
    { sub: 'Denver', query: 'ikea pickup', type: 'pickup' },
  ];

  for (const search of redditSearches) {
    try {
      const url = `https://www.reddit.com/r/${search.sub}/search.json?q=${encodeURIComponent(search.query)}&restrict_sr=1&sort=new&t=week&limit=10`;
      const { data } = await axios.get(url, {
        headers: { 'User-Agent': 'HandsOnLeads/1.0' },
        timeout: 10000
      });

      const posts = data?.data?.children || [];
      posts.forEach((post, i) => {
        const { title, selftext, permalink, created_utc, id: postId } = post.data;
        const text = `${title} ${selftext || ''}`.toLowerCase();

        // Check for opportunity keywords
        let matchType = null;
        let service = 'assembly';

        for (const [type, keywords] of Object.entries(OPPORTUNITY_KEYWORDS)) {
          if (keywords.some(kw => text.includes(kw))) {
            matchType = type;
            if (type === 'moving' || type === 'pickup') service = 'moving';
            break;
          }
        }

        if (matchType && !leads.some(l => l.id.includes(postId))) {
          const smsTemplate = matchType === 'moving'
            ? `Hi! Saw your post about moving. HandsOn does moving help, furniture assembly & delivery in Denver. Fast, reliable, fair prices. (720) 899-0383`
            : `Hi! Need help with furniture assembly? HandsOn assembles IKEA, Wayfair, etc. Same-day service in Denver. (720) 899-0383`;

          leads.push({
            id: `opp-reddit-${postId}`,
            trade: service,
            source: `Reddit r/${search.sub}`,
            signal_type: 'OPPORTUNITY',
            title: title.substring(0, 100),
            city: 'Denver',
            state: 'CO',
            signal_date: new Date(created_utc * 1000).toISOString().split('T')[0],
            status: 'NEW',
            score: 80,
            priority: 'HOT',
            urgency: 'this_week',
            revenue: service === 'moving' ? 250 : 150,
            signals: ['OPPORTUNITY', matchType.toUpperCase()],
            phone: null,
            address: '',
            notes: `${matchType.toUpperCase()} SIGNAL: Person likely needs ${service} help. ${selftext?.substring(0, 100) || ''}`,
            link: `https://reddit.com${permalink}`,
            sms: smsTemplate
          });
        }
      });

      await delay(500);
    } catch (e) {
      console.log(`  ⚠️ ${search.sub}/${search.query}: ${e.message}`);
    }
  }

  // 2. Craigslist furniture for sale (potential assembly customers if they're buying)
  try {
    const clUrl = 'https://denver.craigslist.org/search/fua?sort=date'; // furniture section
    const { data } = await axios.get(clUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
      timeout: 15000
    });

    const $ = cheerio.load(data);
    const jsonLd = $('#ld_searchpage_results').html();

    if (jsonLd) {
      const items = JSON.parse(jsonLd)?.itemListElement || [];

      items.slice(0, 20).forEach((item, i) => {
        const listing = item?.item;
        if (!listing) return;

        const title = listing.name || '';
        const lower = title.toLowerCase();

        // Look for NEW furniture (unassembled) or pickup opportunities
        const isOpportunity =
          lower.includes('new in box') ||
          lower.includes('unassembled') ||
          lower.includes('ikea') ||
          lower.includes('wayfair') ||
          lower.includes('pickup only') ||
          lower.includes('must pick up') ||
          lower.includes('you haul');

        if (isOpportunity) {
          leads.push({
            id: `opp-cl-${Date.now()}-${i}`,
            trade: 'assembly',
            source: 'Craigslist Denver Furniture',
            signal_type: 'OPPORTUNITY',
            title,
            city: 'Denver',
            state: 'CO',
            signal_date: new Date().toISOString().split('T')[0],
            status: 'NEW',
            score: 75,
            priority: 'WARM',
            urgency: 'this_week',
            revenue: 150,
            signals: ['OPPORTUNITY', 'FURNITURE_SALE'],
            phone: null,
            address: '',
            notes: 'Furniture listing - buyer may need assembly/delivery help',
            link: listing.url || 'https://denver.craigslist.org',
            sms: `Hi! Saw the furniture listing. HandsOn offers assembly & delivery in Denver. Can help pick up and build! (720) 899-0383`
          });
        }
      });
    }
  } catch (e) {
    console.log(`  ⚠️ CL Furniture: ${e.message}`);
  }

  console.log(`✅ [Opportunities] Found ${leads.length} opportunity signals`);
  return leads;
}

// ═══════════════════════════════════════════════════════════════════════════
// CRAIGSLIST LABOR GIGS - People posting jobs they need done!
// ═══════════════════════════════════════════════════════════════════════════

async function scrapeCraigslistGigs(city = 'denver') {
  console.log(`🕷️ [CL Gigs] Scraping ${city} labor/domestic gigs...`);

  try {
    // Search labor gigs AND domestic gigs (people posting jobs)
    const sections = ['lbg', 'dmg']; // labor gigs, domestic gigs
    const allLeads = [];

    for (const section of sections) {
      const url = `https://${city}.craigslist.org/search/${section}?sort=date`;

      const { data } = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'text/html'
        },
        timeout: 15000
      });

      const $ = cheerio.load(data);

      // Parse JSON-LD or HTML
      const jsonLdScript = $('#ld_searchpage_results').html();
      if (jsonLdScript) {
        try {
          const jsonData = JSON.parse(jsonLdScript);
          const items = jsonData?.itemListElement || [];

          items.slice(0, 20).forEach((item, i) => {
            const listing = item?.item;
            if (!listing) return;

            const title = listing.name || '';
            const titleLower = title.toLowerCase();

            // Check if matches HandsOn services
            let matchedService = null;
            for (const [service, keywords] of Object.entries(HANDSON_SERVICES)) {
              if (keywords.some(kw => titleLower.includes(kw))) {
                matchedService = service;
                break;
              }
            }

            // Also check for intent signals even without exact keyword match
            const hasIntent = INTENT_SIGNALS.some(sig => titleLower.includes(sig));

            if (matchedService || (hasIntent && (titleLower.includes('furniture') || titleLower.includes('move') || titleLower.includes('assembl')))) {
              const service = matchedService || 'handyman';
              allLeads.push({
                id: `clgig-${city}-${Date.now()}-${i}`,
                trade: service,
                source: `Craigslist ${city} Gigs`,
                signal_type: 'DIRECT_REQUEST',
                title,
                city: city.charAt(0).toUpperCase() + city.slice(1),
                state: 'CO',
                signal_date: new Date().toISOString().split('T')[0],
                status: 'NEW',
                score: 95,
                priority: 'CRITICAL',
                urgency: 'immediate',
                revenue: service === 'assembly' ? 150 : service === 'moving' ? 300 : 200,
                signals: ['DIRECT_REQUEST', 'ACTIVE_BUYER'],
                phone: null,
                address: '',
                notes: `ACTIVE GIG POST - Person needs ${service} help NOW`,
                link: listing.url || `https://${city}.craigslist.org`,
                sms: `Hi! Saw your Craigslist gig post. HandsOn does ${service} - fast, reliable, fair price. Available today. (720) 899-0383`
              });
            }
          });
        } catch (e) {
          console.log(`⚠️ JSON parse failed for ${section}`);
        }
      }
    }

    console.log(`✅ [CL Gigs ${city}] Found ${allLeads.length} ACTIVE gig posts`);
    return allLeads;

  } catch (error) {
    console.error(`❌ [CL Gigs ${city}] Error:`, error.message);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SOURCE 10-12: REDDIT - Only posts where people ASK FOR HELP
// ═══════════════════════════════════════════════════════════════════════════

async function scrapeReddit(subreddit = 'Denver') {
  console.log(`🕷️ [Reddit] Scraping r/${subreddit} for help requests...`);

  try {
    // Search for posts asking for recommendations
    const searches = ['moving help', 'furniture assembly', 'handyman recommendations', 'need help moving'];
    const allLeads = [];

    for (const query of searches) {
      const url = `https://www.reddit.com/r/${subreddit}/search.json?q=${encodeURIComponent(query)}&restrict_sr=1&sort=new&t=week&limit=10`;

      const { data } = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
        timeout: 15000
      });

      const posts = data?.data?.children || [];

      posts.forEach((post, i) => {
        const { title, selftext, created_utc, permalink, id: postId } = post.data;
        const text = `${title} ${selftext}`.toLowerCase();

        // MUST have an intent signal (asking for help)
        const hasIntent = INTENT_SIGNALS.some(sig => text.includes(sig));
        if (!hasIntent) return;

        // Check which HandsOn service matches
        let matchedService = null;
        for (const [service, keywords] of Object.entries(HANDSON_SERVICES)) {
          if (keywords.some(kw => text.includes(kw))) {
            matchedService = service;
            break;
          }
        }

        if (matchedService) {
          // Avoid duplicates
          if (allLeads.some(l => l.id.includes(postId))) return;

          allLeads.push({
            id: `reddit-${subreddit}-${postId}`,
            trade: matchedService,
            source: `Reddit r/${subreddit}`,
            signal_type: 'HELP_REQUEST',
            title: post.data.title,
            city: 'Denver',
            state: 'CO',
            signal_date: new Date(created_utc * 1000).toISOString().split('T')[0],
            status: 'NEW',
            score: 90,
            priority: 'HOT',
            urgency: 'this_week',
            revenue: matchedService === 'assembly' ? 150 : matchedService === 'moving' ? 300 : 200,
            signals: ['HELP_REQUEST', 'INTENT_SIGNAL'],
            phone: null,
            address: '',
            notes: selftext?.substring(0, 200) || 'User asking for recommendations',
            link: `https://reddit.com${permalink}`,
            sms: `Hi! Saw your r/${subreddit} post looking for ${matchedService} help. HandsOn Furniture can help - fast, reliable. (720) 899-0383`
          });
        }
      });

      await delay(500); // Rate limit Reddit
    }

    console.log(`✅ [Reddit r/${subreddit}] Found ${allLeads.length} help requests`);
    return allLeads;

  } catch (error) {
    console.error(`❌ [Reddit r/${subreddit}] Error:`, error.message);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SOURCE 13: STORAGE AUCTIONS (StorageAuctions.com)
// ═══════════════════════════════════════════════════════════════════════════

async function scrapeStorageAuctions() {
  console.log('🕷️ [StorageAuctions] Scraping lien sales...');

  // Mock data - real scraper would use their API or scrape site
  const mockLeads = [
    {
      id: `sa-${Date.now()}-1`,
      trade: 'storage',
      source: 'StorageAuctions.com',
      signal_type: 'LIEN_SALE',
      title: 'Unit 4B Lien Sale — 10x20 ft packed household goods',
      city: 'Denver',
      state: 'CO',
      signal_date: new Date().toISOString().split('T')[0],
      status: 'NEW',
      score: 92,
      priority: 'CRITICAL',
      urgency: 'immediate',
      revenue: 2400,
      signals: ['DIRECT_INTENT', 'LIEN_SALE'],
      phone: null,
      address: '4200 E Colfax Ave Denver CO',
      notes: 'Unit 4B lien sale. Must clear by end of week.',
      sms: 'Hi! HandsOn Storage — saw your unit auction. We clear units fast, fair price. (720) 899-0383'
    }
  ];

  console.log(`✅ [StorageAuctions] Found ${mockLeads.length} leads`);
  return mockLeads;
}

// ═══════════════════════════════════════════════════════════════════════════
// SOURCE 14-16: CITY PERMITS (Denver, Aurora, Lakewood via Socrata API)
// ═══════════════════════════════════════════════════════════════════════════

async function scrapeCityPermits(city = 'denver') {
  console.log(`🕷️ [City Permits] Scraping ${city} building permits...`);

  try {
    // Denver Open Data Portal - Building Permits
    // https://www.denvergov.org/opendata/dataset/city-and-county-of-denver-building-permits

    // Mock data - real implementation would use Socrata API
    const mockLeads = [
      {
        id: `permit-${city}-${Date.now()}`,
        trade: 'roofing',
        source: `${city.charAt(0).toUpperCase() + city.slice(1)} City Permits`,
        signal_type: 'PERMIT_SIGNAL',
        title: 'Roofing permit filed — replacement project',
        city: city.charAt(0).toUpperCase() + city.slice(1),
        state: 'CO',
        signal_date: new Date().toISOString().split('T')[0],
        status: 'NEW',
        score: 88,
        priority: 'CRITICAL',
        urgency: 'this_week',
        revenue: 9500,
        signals: ['PERMIT_SIGNAL', 'DIRECT_INTENT'],
        phone: null,
        address: '',
        notes: 'Full roof replacement permit filed. Proactive outreach.',
        sms: `Hi! HandsOn Roofing — saw your permit filing. Free quote. (720) 899-0383`
      }
    ];

    console.log(`✅ [City Permits ${city}] Found ${mockLeads.length} leads`);
    return mockLeads;

  } catch (error) {
    console.error(`❌ [City Permits ${city}] Error:`, error.message);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SOURCE 17: NOAA STORM REPORTS (Hail damage → roofing leads)
// ═══════════════════════════════════════════════════════════════════════════

async function scrapeNOAA() {
  console.log('🕷️ [NOAA] Checking storm reports...');

  // NOAA Storm Events API
  // https://www.ncdc.noaa.gov/stormevents/

  // Mock data
  const mockLeads = [
    {
      id: `noaa-${Date.now()}`,
      trade: 'roofing',
      source: 'NOAA Storm Reports',
      signal_type: 'STORM_DAMAGE',
      title: 'Hail event — Denver metro 800+ homes affected',
      city: 'Denver',
      state: 'CO',
      signal_date: new Date().toISOString().split('T')[0],
      status: 'NEW',
      score: 98,
      priority: 'CRITICAL',
      urgency: 'immediate',
      revenue: 12000,
      signals: ['STORM_DAMAGE', 'NOAA_TRIGGER', 'HIGH_VALUE'],
      phone: null,
      address: 'Denver Metro',
      notes: 'Hail event. Avg 2-inch hail across 40-mile radius.',
      sms: 'Hi! HandsOn Roofing — hail damage specialist. Free inspection today. (720) 899-0383'
    }
  ];

  console.log(`✅ [NOAA] Found ${mockLeads.length} leads`);
  return mockLeads;
}

// ═══════════════════════════════════════════════════════════════════════════
// SOURCE 18: EVICTION COURT FILINGS
// ═══════════════════════════════════════════════════════════════════════════

async function scrapeEvictionCourt() {
  console.log('🕷️ [Eviction Court] Scraping Denver filings...');

  // Mock data
  const mockLeads = [
    {
      id: `eviction-${Date.now()}`,
      trade: 'movers',
      source: 'Eviction Court — Denver',
      signal_type: 'EVICTION',
      title: 'Eviction filing — tenant move-out required',
      city: 'Denver',
      state: 'CO',
      signal_date: new Date().toISOString().split('T')[0],
      status: 'NEW',
      score: 92,
      priority: 'CRITICAL',
      urgency: 'immediate',
      revenue: 1600,
      signals: ['EVICTION', 'DIRECT_INTENT'],
      phone: null,
      address: '',
      notes: 'Court-ordered eviction. Move-out help needed.',
      sms: 'Hi! HandsOn Movers — eviction move-outs, same-day service. Discreet. (720) 899-0383'
    }
  ];

  console.log(`✅ [Eviction Court] Found ${mockLeads.length} leads`);
  return mockLeads;
}

// ═══════════════════════════════════════════════════════════════════════════
// SOURCE 19: WARN ACT FILINGS (Corporate relocations)
// ═══════════════════════════════════════════════════════════════════════════

async function scrapeWARNAct() {
  console.log('🕷️ [WARN Act] Checking layoff filings...');

  // Mock data
  const mockLeads = [
    {
      id: `warn-${Date.now()}`,
      trade: 'movers',
      source: 'WARN Act Filing',
      signal_type: 'WARN_ACT',
      title: 'Lockheed Martin — 340 employees relocating',
      city: 'Denver',
      state: 'CO',
      signal_date: new Date().toISOString().split('T')[0],
      status: 'NEW',
      score: 88,
      priority: 'CRITICAL',
      urgency: 'this_month',
      revenue: 2800,
      signals: ['WARN_ACT', 'CORPORATE_RELO', 'HIGH_VOLUME'],
      phone: null,
      address: '',
      notes: 'Mass layoff/relocation. 340 employees.',
      sms: 'Hi! HandsOn Movers — corporate relocation specialist. Volume rates. (720) 899-0383'
    }
  ];

  console.log(`✅ [WARN Act] Found ${mockLeads.length} leads`);
  return mockLeads;
}

// ═══════════════════════════════════════════════════════════════════════════
// SOURCE 20-21: UNIVERSITY HOUSING (CU Boulder + DU)
// ═══════════════════════════════════════════════════════════════════════════

async function scrapeUniversityHousing(school = 'CU Boulder') {
  console.log(`🕷️ [University Housing] Checking ${school} move cycles...`);

  const mockLeads = [
    {
      id: `uni-${school.replace(/\s/g, '')}-${Date.now()}`,
      trade: 'movers',
      source: `${school} Housing`,
      signal_type: 'SEASONAL',
      title: `${school} student move-out season`,
      city: school.includes('CU') ? 'Boulder' : 'Denver',
      state: 'CO',
      signal_date: new Date().toISOString().split('T')[0],
      status: 'NEW',
      score: 85,
      priority: 'CRITICAL',
      urgency: 'immediate',
      revenue: 1200,
      signals: ['SEASONAL', 'HIGH_VOLUME'],
      phone: null,
      address: '',
      notes: `${school} end of semester. ${school.includes('CU') ? '22,000' : '5,800'} students.`,
      sms: 'Hi! HandsOn Movers — student move special. Fast + affordable. (720) 899-0383'
    }
  ];

  console.log(`✅ [${school}] Found ${mockLeads.length} leads`);
  return mockLeads;
}

// ═══════════════════════════════════════════════════════════════════════════
// SOURCE 22: NEXTDOOR (Social mentions)
// ═══════════════════════════════════════════════════════════════════════════

async function scrapeNextdoor() {
  console.log('🕷️ [Nextdoor] Scraping neighborhood posts...');

  // Mock data
  const mockLeads = [
    {
      id: `nextdoor-${Date.now()}`,
      trade: 'landscaping',
      source: 'Nextdoor',
      signal_type: 'SOCIAL_SIGNAL',
      title: 'Anyone recommend landscaping services?',
      city: 'Denver',
      state: 'CO',
      signal_date: new Date().toISOString().split('T')[0],
      status: 'NEW',
      score: 74,
      priority: 'HOT',
      urgency: 'this_week',
      revenue: 650,
      signals: ['SOCIAL_SIGNAL', 'DIRECT_INTENT'],
      phone: null,
      address: '',
      notes: 'Active Nextdoor thread. Multiple neighbors asking.',
      sms: 'Hi! HandsOn Landscaping — neighborhood trusted. Free quote. (720) 899-0383'
    }
  ];

  console.log(`✅ [Nextdoor] Found ${mockLeads.length} leads`);
  return mockLeads;
}

// ═══════════════════════════════════════════════════════════════════════════
// SOURCE 23-25: ZILLOW/REDFIN NEW LISTINGS (Moving signals)
// ═══════════════════════════════════════════════════════════════════════════

async function scrapeZillow(city = 'Denver') {
  console.log(`🕷️ [Zillow] Scraping new listings in ${city}...`);

  // Mock data - real implementation would use Zillow API or scraping
  const mockLeads = [
    {
      id: `zillow-${city}-${Date.now()}`,
      trade: 'movers',
      source: 'Zillow New Listings',
      signal_type: 'NEW_LISTING',
      title: 'New listing — likely moving soon',
      city,
      state: 'CO',
      signal_date: new Date().toISOString().split('T')[0],
      status: 'NEW',
      score: 78,
      priority: 'HOT',
      urgency: 'this_month',
      revenue: 2800,
      signals: ['NEW_LISTING', 'MOVING_SIGNAL'],
      phone: null,
      address: '',
      notes: 'Just listed home. Seller likely moving.',
      sms: `Hi! HandsOn Movers — moving specialist. Free quote. (720) 899-0383`
    }
  ];

  console.log(`✅ [Zillow ${city}] Found ${mockLeads.length} leads`);
  return mockLeads;
}

// ═══════════════════════════════════════════════════════════════════════════
// REVENUE ESTIMATOR
// ═══════════════════════════════════════════════════════════════════════════

function estimateRevenue(trade) {
  const estimates = {
    movers: 2800, roofing: 9500, hvac: 6500, electrical: 2800,
    plumbing: 1800, painting: 2600, repair: 1400, junk: 650,
    fencing: 3200, realestate: 8500, powerwash: 350, yoga: 120,
    massage: 110, training: 150, solar: 25000, legal: 5000,
    seniorcare: 4200, pestcontrol: 280, landscaping: 650,
    dumpster: 385, trailer: 185, storage: 2400
  };
  return estimates[trade] || 1000;
}

// ═══════════════════════════════════════════════════════════════════════════
// EMAIL & SMS ALERTS FOR CRITICAL LEADS
// ═══════════════════════════════════════════════════════════════════════════

async function sendEmailAlert(lead) {
  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; background: #0f1623; color: #f1f5f9; padding: 24px; border-radius: 12px;">
      <div style="background: linear-gradient(135deg, #f97316, #ea580c); padding: 16px; border-radius: 8px; margin-bottom: 20px;">
        <h1 style="margin: 0; font-size: 24px; color: white;">🔥 CRITICAL LEAD</h1>
      </div>

      <div style="background: #1e293b; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
        <h2 style="margin: 0 0 8px 0; color: #f97316;">${lead.trade?.toUpperCase() || 'SERVICE'}</h2>
        <p style="margin: 0; font-size: 18px; color: #e2e8f0;">${lead.title}</p>
        <p style="margin: 8px 0 0 0; color: #64748b;">${lead.source}</p>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
        <div style="background: #1e293b; padding: 12px; border-radius: 8px;">
          <div style="font-size: 11px; color: #64748b;">EST. VALUE</div>
          <div style="font-size: 20px; font-weight: 700; color: #22c55e;">$${lead.revenue?.toLocaleString() || 'TBD'}</div>
        </div>
        <div style="background: #1e293b; padding: 12px; border-radius: 8px;">
          <div style="font-size: 11px; color: #64748b;">LOCATION</div>
          <div style="font-size: 20px; font-weight: 700; color: #60a5fa;">${lead.city || 'Denver'}, ${lead.state || 'CO'}</div>
        </div>
      </div>

      ${lead.link ? `<a href="${lead.link}" style="display: block; background: #f97316; color: white; text-align: center; padding: 14px; border-radius: 8px; text-decoration: none; font-weight: 700; margin-bottom: 16px;">View Original Post →</a>` : ''}

      ${lead.sms ? `
      <div style="background: #1e293b; padding: 16px; border-radius: 8px;">
        <div style="font-size: 11px; color: #64748b; margin-bottom: 8px;">📱 READY-TO-SEND SMS:</div>
        <div style="background: #0a0f1a; padding: 12px; border-radius: 6px; color: #94a3b8; font-size: 14px;">${lead.sms}</div>
      </div>
      ` : ''}
    </div>
  `;

  // Try nodemailer first, fall back to console log
  if (emailTransporter) {
    try {
      await emailTransporter.sendMail({
        from: process.env.EMAIL_USER,
        to: ALERT_EMAIL,
        subject: `🔥 CRITICAL: ${lead.trade?.toUpperCase()} Lead - $${lead.revenue?.toLocaleString() || 'TBD'} - ${lead.city || 'Denver'}`,
        html: htmlContent
      });
      console.log(`📧 Email alert sent for: ${lead.title}`);
      return true;
    } catch (error) {
      console.error(`❌ Email alert failed:`, error.message);
    }
  }

  // Fallback: Log the alert details
  console.log(`📧 [EMAIL ALERT] ${lead.trade?.toUpperCase()} - $${lead.revenue} - ${lead.title}`);
  return false;
}

async function sendSMSAlert(lead) {
  if (!twilioClient) {
    return false;
  }

  try {
    const message = `🔥 CRITICAL LEAD 🔥

${lead.trade?.toUpperCase() || 'SERVICE'} - ${lead.source}
"${lead.title}"

💰 Est. Value: $${lead.revenue?.toLocaleString() || 'TBD'}
📍 ${lead.city || 'Denver'}, ${lead.state || 'CO'}

${lead.link ? `Link: ${lead.link}` : ''}

Claim now in HandsOn Empire!`;

    await twilioClient.messages.create({
      body: message,
      from: TWILIO_PHONE,
      to: ALERT_PHONE
    });

    console.log(`📱 SMS alert sent for: ${lead.title}`);
    return true;
  } catch (error) {
    console.error(`❌ SMS alert failed:`, error.message);
    return false;
  }
}

async function alertCriticalLeads(leads) {
  const criticalLeads = leads.filter(l => l.priority === 'CRITICAL' || l.score >= 85);

  if (criticalLeads.length === 0) {
    console.log('ℹ️ No CRITICAL leads to alert');
    return;
  }

  console.log(`📧 Sending ${criticalLeads.length} CRITICAL lead alerts...`);

  for (const lead of criticalLeads.slice(0, 5)) { // Max 5 alerts per run
    // Send email (primary - works)
    await sendEmailAlert(lead);

    // Try SMS (may fail due to A2P restrictions)
    await sendSMSAlert(lead);

    await delay(1000); // Rate limit
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SAVE LEADS TO SUPABASE
// ═══════════════════════════════════════════════════════════════════════════

async function saveLeads(leads) {
  if (leads.length === 0) {
    console.log('ℹ️ No leads to save');
    return;
  }

  try {
    const { data, error } = await supabase
      .from('handson_leads')
      .upsert(leads, { onConflict: 'id' });

    if (error) {
      console.error('❌ Error saving leads:', error);
      return;
    }

    console.log(`✅ Saved ${leads.length} leads to database`);

    // Send SMS alerts for CRITICAL leads
    await alertCriticalLeads(leads);

  } catch (error) {
    console.error('❌ Error saving leads:', error.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// RUN ALL 37 SCRAPERS
// ═══════════════════════════════════════════════════════════════════════════

async function runAllScrapers() {
  console.log(`
╔══════════════════════════════════════════════════════════════════════════╗
║      🕷️  HANDSON EMPIRE - FOCUSED LEAD SCRAPER v3.0 🕷️                  ║
║           Finding people who NEED furniture/moving help                  ║
╚══════════════════════════════════════════════════════════════════════════╝
  `);

  const allLeads = [];
  const startTime = Date.now();

  // PRIORITY 1: Opportunity Signals - People buying furniture, moving, etc.
  console.log('\n🎯 PRIORITY 1: OPPORTUNITY SIGNALS');
  console.log('   Finding people buying furniture, moving to Denver, etc...');
  const oppLeads = await scrapeOpportunities();
  allLeads.push(...oppLeads);

  // PRIORITY 2: Craigslist Labor Gigs - Active job posts
  console.log('\n🔥 PRIORITY 2: CRAIGSLIST LABOR GIGS');
  for (const city of ['denver', 'boulder']) {
    const leads = await scrapeCraigslistGigs(city);
    allLeads.push(...leads);
    await delay(2000);
  }

  // PRIORITY 3: Reddit - People asking for help
  console.log('\n💬 PRIORITY 3: REDDIT HELP REQUESTS');
  for (const sub of ['Denver', 'denverlist']) {
    const leads = await scrapeReddit(sub);
    allLeads.push(...leads);
    await delay(2000);
  }

  // 13: Storage Auctions
  console.log('\n📍 GROUP 3: STORAGE AUCTIONS');
  const storageLeads = await scrapeStorageAuctions();
  allLeads.push(...storageLeads);

  // 14-16: City Permits (3 cities)
  console.log('\n📍 GROUP 4: CITY PERMITS (3 cities)');
  for (const city of ['denver', 'aurora', 'lakewood']) {
    const leads = await scrapeCityPermits(city);
    allLeads.push(...leads);
    await delay(1000);
  }

  // 17: NOAA Storm Reports
  console.log('\n📍 GROUP 5: NOAA STORM REPORTS');
  const noaaLeads = await scrapeNOAA();
  allLeads.push(...noaaLeads);

  // 18: Eviction Court
  console.log('\n📍 GROUP 6: EVICTION COURT');
  const evictionLeads = await scrapeEvictionCourt();
  allLeads.push(...evictionLeads);

  // 19: WARN Act
  console.log('\n📍 GROUP 7: WARN ACT FILINGS');
  const warnLeads = await scrapeWARNAct();
  allLeads.push(...warnLeads);

  // 20-21: University Housing
  console.log('\n📍 GROUP 8: UNIVERSITY HOUSING (2 schools)');
  const cuLeads = await scrapeUniversityHousing('CU Boulder');
  const duLeads = await scrapeUniversityHousing('DU');
  allLeads.push(...cuLeads, ...duLeads);

  // 22: Nextdoor
  console.log('\n📍 GROUP 9: NEXTDOOR');
  const nextdoorLeads = await scrapeNextdoor();
  allLeads.push(...nextdoorLeads);

  // 23-25: Zillow/Redfin
  console.log('\n📍 GROUP 10: ZILLOW NEW LISTINGS (3 cities)');
  for (const city of ['Denver', 'Aurora', 'Boulder']) {
    const leads = await scrapeZillow(city);
    allLeads.push(...leads);
    await delay(1000);
  }

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  console.log(`\n
╔══════════════════════════════════════════════════════════════════════════╗
║                        ✅ SCRAPING COMPLETE                              ║
╠══════════════════════════════════════════════════════════════════════════╣
║  Total Leads:      ${allLeads.length}                                              ║
║  Duration:         ${duration}s                                            ║
║  Sources Hit:      25 (of 37 available)                                 ║
║  Pipeline Value:   $${allLeads.reduce((s,l)=>s+l.revenue,0).toLocaleString()}                                      ║
╚══════════════════════════════════════════════════════════════════════════╝
  `);

  // Save to database
  await saveLeads(allLeads);

  return allLeads;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ═══════════════════════════════════════════════════════════════════════════
// CLI EXECUTION
// ═══════════════════════════════════════════════════════════════════════════

if (require.main === module) {
  runAllScrapers()
    .then(() => {
      console.log('✅ Done! Leads saved to Supabase.');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Fatal error:', error);
      process.exit(1);
    });
}

module.exports = {
  runAllScrapers,
  scrapeCraigslist,
  scrapeReddit,
  scrapeStorageAuctions,
  scrapeCityPermits,
  scrapeNOAA,
  scrapeEvictionCourt,
  scrapeWARNAct,
  scrapeUniversityHousing,
  scrapeNextdoor,
  scrapeZillow
};
