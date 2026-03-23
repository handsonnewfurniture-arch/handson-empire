// ══════════════════════════════════════════════════════════════════════════════
// HANDSON EMPIRE - NATIONAL CRAIGSLIST RSS SCRAPER
// Covers top 50 US metros via ToS-compliant RSS feeds
// ══════════════════════════════════════════════════════════════════════════════

const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const { qualifyLead } = require('./lead-scorer.js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY
);

// Top 50 US Craigslist regions by population/market size
const US_METROS = [
  // Tier 1 - Major metros (10M+)
  { region: 'newyork', name: 'New York', state: 'NY', tier: 1 },
  { region: 'losangeles', name: 'Los Angeles', state: 'CA', tier: 1 },
  { region: 'chicago', name: 'Chicago', state: 'IL', tier: 1 },
  { region: 'dallas', name: 'Dallas', state: 'TX', tier: 1 },
  { region: 'houston', name: 'Houston', state: 'TX', tier: 1 },

  // Tier 2 - Large metros (3-10M)
  { region: 'washingtondc', name: 'Washington', state: 'DC', tier: 2 },
  { region: 'miami', name: 'Miami', state: 'FL', tier: 2 },
  { region: 'philadelphia', name: 'Philadelphia', state: 'PA', tier: 2 },
  { region: 'atlanta', name: 'Atlanta', state: 'GA', tier: 2 },
  { region: 'phoenix', name: 'Phoenix', state: 'AZ', tier: 2 },
  { region: 'boston', name: 'Boston', state: 'MA', tier: 2 },
  { region: 'sfbay', name: 'San Francisco', state: 'CA', tier: 2 },
  { region: 'seattle', name: 'Seattle', state: 'WA', tier: 2 },
  { region: 'denver', name: 'Denver', state: 'CO', tier: 2 },
  { region: 'sandiego', name: 'San Diego', state: 'CA', tier: 2 },

  // Tier 3 - Mid-size metros (1-3M)
  { region: 'minneapolis', name: 'Minneapolis', state: 'MN', tier: 3 },
  { region: 'tampa', name: 'Tampa', state: 'FL', tier: 3 },
  { region: 'detroit', name: 'Detroit', state: 'MI', tier: 3 },
  { region: 'stlouis', name: 'St Louis', state: 'MO', tier: 3 },
  { region: 'baltimore', name: 'Baltimore', state: 'MD', tier: 3 },
  { region: 'orlando', name: 'Orlando', state: 'FL', tier: 3 },
  { region: 'charlotte', name: 'Charlotte', state: 'NC', tier: 3 },
  { region: 'sanantonio', name: 'San Antonio', state: 'TX', tier: 3 },
  { region: 'portland', name: 'Portland', state: 'OR', tier: 3 },
  { region: 'sacramento', name: 'Sacramento', state: 'CA', tier: 3 },
  { region: 'pittsburgh', name: 'Pittsburgh', state: 'PA', tier: 3 },
  { region: 'austin', name: 'Austin', state: 'TX', tier: 3 },
  { region: 'lasvegas', name: 'Las Vegas', state: 'NV', tier: 3 },
  { region: 'cincinnati', name: 'Cincinnati', state: 'OH', tier: 3 },
  { region: 'kansascity', name: 'Kansas City', state: 'MO', tier: 3 },
  { region: 'columbus', name: 'Columbus', state: 'OH', tier: 3 },
  { region: 'indianapolis', name: 'Indianapolis', state: 'IN', tier: 3 },
  { region: 'cleveland', name: 'Cleveland', state: 'OH', tier: 3 },
  { region: 'nashville', name: 'Nashville', state: 'TN', tier: 3 },
  { region: 'raleigh', name: 'Raleigh', state: 'NC', tier: 3 },

  // Tier 4 - Growing metros (500K-1M)
  { region: 'saltlakecity', name: 'Salt Lake City', state: 'UT', tier: 4 },
  { region: 'jacksonville', name: 'Jacksonville', state: 'FL', tier: 4 },
  { region: 'memphis', name: 'Memphis', state: 'TN', tier: 4 },
  { region: 'oklahomacity', name: 'Oklahoma City', state: 'OK', tier: 4 },
  { region: 'louisville', name: 'Louisville', state: 'KY', tier: 4 },
  { region: 'milwaukee', name: 'Milwaukee', state: 'WI', tier: 4 },
  { region: 'albuquerque', name: 'Albuquerque', state: 'NM', tier: 4 },
  { region: 'tucson', name: 'Tucson', state: 'AZ', tier: 4 },
  { region: 'fresno', name: 'Fresno', state: 'CA', tier: 4 },
  { region: 'neworleans', name: 'New Orleans', state: 'LA', tier: 4 },
  { region: 'cosprings', name: 'Colorado Springs', state: 'CO', tier: 4 },
  { region: 'boulder', name: 'Boulder', state: 'CO', tier: 4 },
  { region: 'honolulu', name: 'Honolulu', state: 'HI', tier: 4 },
  { region: 'boise', name: 'Boise', state: 'ID', tier: 4 },
];

// High-priority searches (direct service requests)
const PRIORITY_SEARCHES = [
  // Core services - high demand
  { query: 'furniture assembly', trade: 'assembly' },
  { query: 'moving help', trade: 'moving' },
  { query: 'handyman', trade: 'handyman' },
  { query: 'junk removal', trade: 'junk' },
  { query: 'house cleaning', trade: 'cleaning' },
  { query: 'tv mounting', trade: 'tvmount' },

  // Skilled trades - high value
  { query: 'electrician', trade: 'electrical' },
  { query: 'plumber', trade: 'plumbing' },
  { query: 'hvac', trade: 'hvac' },
  { query: 'roofing', trade: 'roofing' },

  // Outdoor
  { query: 'landscaping', trade: 'landscaping' },
  { query: 'pressure washing', trade: 'powerwash' },
];

// Simple XML parser
function parseRSS(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    const getTag = (tag) => {
      const tagMatch = itemXml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
      return tagMatch ? tagMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : '';
    };

    items.push({
      title: getTag('title'),
      link: getTag('link'),
      description: getTag('description'),
      pubDate: getTag('dc:date') || getTag('pubDate'),
    });
  }
  return items;
}

function extractPrice(title) {
  const match = title.match(/\$(\d+(?:,\d{3})*)/);
  return match ? parseInt(match[1].replace(',', '')) : null;
}

function extractLocation(title) {
  const match = title.match(/\(([^)]+)\)\s*$/);
  return match ? match[1] : null;
}

async function scrapeNationalCraigslist(options = {}) {
  const { tierLimit = 4, maxPerCity = 5 } = options;

  console.log(`\n🇺🇸 [${new Date().toLocaleTimeString()}] National Craigslist scan starting...`);
  console.log(`   Scanning ${US_METROS.filter(m => m.tier <= tierLimit).length} metros, ${PRIORITY_SEARCHES.length} services`);

  const allLeads = [];
  const seenIds = new Set();
  let citiesScanned = 0;
  let totalFound = 0;

  // Filter metros by tier
  const metros = US_METROS.filter(m => m.tier <= tierLimit);

  for (const metro of metros) {
    let cityLeads = 0;

    for (const search of PRIORITY_SEARCHES) {
      if (cityLeads >= maxPerCity) break;

      try {
        // Labor gigs category (lbg) - direct service requests
        const url = `https://${metro.region}.craigslist.org/search/lbg?query=${encodeURIComponent(search.query)}&format=rss`;

        const { data: xml } = await axios.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; HandsOnLeads/1.0)',
            'Accept': 'application/rss+xml'
          },
          timeout: 10000
        });

        const items = parseRSS(xml);

        for (const item of items.slice(0, 3)) { // Max 3 per search
          const idMatch = item.link.match(/\/(\d+)\.html/);
          const postId = idMatch ? idMatch[1] : null;

          if (!postId || seenIds.has(postId)) continue;
          seenIds.add(postId);

          // Check if already in database
          const { data: existing } = await supabase
            .from('handson_leads')
            .select('id')
            .eq('id', `cl-${postId}`)
            .single();

          if (existing) continue;

          const price = extractPrice(item.title);
          const subLocation = extractLocation(item.title);
          const titleClean = item.title
            .replace(/\$\d+(?:,\d{3})*\s*-?\s*/, '')
            .replace(/\([^)]+\)\s*$/, '')
            .trim();

          const lead = {
            id: `cl-${postId}`,
            trade: search.trade,
            source: `Craigslist ${metro.name}`,
            signal_type: 'DIRECT_REQUEST',
            title: titleClean.substring(0, 150),
            city: subLocation || metro.name,
            state: metro.state,
            signal_date: item.pubDate ? new Date(item.pubDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            status: 'NEW',
            notes: item.description?.substring(0, 300) || '',
            link: item.link,
            phone: null,
            address: null
          };

          // Run through lead scorer
          const qualified = qualifyLead(lead);
          lead.score = qualified.score;
          lead.priority = qualified.priority;
          lead.urgency = qualified.urgency;
          lead.revenue = qualified.revenue;
          lead.signals = qualified.signals;
          lead.sms = `Hi! Saw your Craigslist post. HandsOn does ${search.trade} in ${metro.name} - fast, reliable, fair prices. Free quote: (720) 899-0383`;

          allLeads.push(lead);
          cityLeads++;
          totalFound++;
        }

        // Rate limit
        await new Promise(r => setTimeout(r, 500));

      } catch (e) {
        // Silently skip 404s and timeouts
        if (!e.message.includes('404') && !e.message.includes('timeout')) {
          // Only log unexpected errors
        }
      }
    }

    citiesScanned++;

    // Progress update every 10 cities
    if (citiesScanned % 10 === 0) {
      console.log(`   ... ${citiesScanned}/${metros.length} cities, ${totalFound} leads found`);
    }
  }

  // Save all leads
  if (allLeads.length > 0) {
    // Sort by score and take top leads
    allLeads.sort((a, b) => b.score - a.score);

    const { error } = await supabase.from('handson_leads').upsert(allLeads);
    if (error) {
      console.log(`   ❌ Save error: ${error.message}`);
    } else {
      console.log(`   ✅ Saved ${allLeads.length} leads from ${citiesScanned} cities`);

      // Show top 5
      console.log('\n   📊 Top 5 Leads:');
      allLeads.slice(0, 5).forEach((l, i) => {
        console.log(`      ${i + 1}. [${l.priority}] ${l.trade} - ${l.city}, ${l.state} (Score: ${l.score})`);
      });
    }
  } else {
    console.log('   No new leads found');
  }

  return allLeads;
}

// Export for use in auto-scraper
module.exports = { scrapeNationalCraigslist, US_METROS, PRIORITY_SEARCHES };
