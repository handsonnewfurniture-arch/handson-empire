// ══════════════════════════════════════════════════════════════════════════════
// CRAIGSLIST RSS FEED MONITOR
// ToS-compliant lead discovery via official RSS feeds
// ══════════════════════════════════════════════════════════════════════════════

const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY
);

// Denver metro Craigslist regions
const CL_REGIONS = [
  'denver',
  'boulder',
  'cosprings'
];

// Service categories and their Craigslist search queries
const SEARCHES = [
  // Direct service requests (labor gigs)
  { category: 'lbg', query: 'furniture assembly', trade: 'assembly', priority: 'HOT' },
  { category: 'lbg', query: 'moving help', trade: 'moving', priority: 'HOT' },
  { category: 'lbg', query: 'handyman', trade: 'handyman', priority: 'HOT' },
  { category: 'lbg', query: 'junk removal', trade: 'junk', priority: 'HOT' },
  { category: 'lbg', query: 'delivery', trade: 'delivery', priority: 'WARM' },

  // Free stuff that needs hauling (opportunity leads)
  { category: 'zip', query: 'free couch', trade: 'junk', priority: 'WARM' },
  { category: 'zip', query: 'free furniture', trade: 'junk', priority: 'WARM' },
  { category: 'zip', query: 'curb alert', trade: 'junk', priority: 'WARM' },

  // For sale - pickup only (delivery opportunity)
  { category: 'fuo', query: 'pickup only', trade: 'delivery', priority: 'WARM' },
  { category: 'fuo', query: 'you haul', trade: 'moving', priority: 'WARM' },

  // Community posts seeking help
  { category: 'com', query: 'need help moving', trade: 'moving', priority: 'CRITICAL' },
  { category: 'com', query: 'looking for mover', trade: 'moving', priority: 'CRITICAL' },
  { category: 'com', query: 'furniture assembly', trade: 'assembly', priority: 'HOT' },
];

// Simple XML parser for RSS (no dependency needed)
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

// Extract price from title like "$150 - Moving help needed"
function extractPrice(title) {
  const match = title.match(/\$(\d+(?:,\d{3})*)/);
  return match ? parseInt(match[1].replace(',', '')) : null;
}

// Extract location from title like "Moving help (Lakewood)"
function extractLocation(title) {
  const match = title.match(/\(([^)]+)\)\s*$/);
  return match ? match[1] : 'Denver';
}

async function scrapeCraigslistRSS() {
  console.log(`\n📰 [${new Date().toLocaleTimeString()}] Scanning Craigslist RSS feeds...`);
  const leads = [];
  const seenIds = new Set();

  for (const region of CL_REGIONS) {
    for (const search of SEARCHES) {
      try {
        // Build RSS feed URL
        // Format: https://denver.craigslist.org/search/lbg?query=furniture+assembly&format=rss
        const url = `https://${region}.craigslist.org/search/${search.category}?query=${encodeURIComponent(search.query)}&format=rss`;

        const { data: xml } = await axios.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; HandsOnLeads/1.0; +https://handson.ventures)',
            'Accept': 'application/rss+xml, application/xml, text/xml'
          },
          timeout: 15000
        });

        const items = parseRSS(xml);

        for (const item of items) {
          // Extract Craigslist post ID from link
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
          const location = extractLocation(item.title);
          const titleClean = item.title.replace(/\$\d+(?:,\d{3})*\s*-?\s*/, '').replace(/\([^)]+\)\s*$/, '').trim();

          // Estimate revenue based on trade type
          let revenue = price || 150;
          if (!price) {
            if (search.trade === 'moving') revenue = 250;
            if (search.trade === 'junk') revenue = 175;
            if (search.trade === 'handyman') revenue = 200;
          }

          const lead = {
            id: `cl-${postId}`,
            trade: search.trade,
            source: `Craigslist ${region}`,
            signal_type: search.category === 'lbg' ? 'DIRECT_REQUEST' : 'OPPORTUNITY',
            title: titleClean.substring(0, 150),
            city: location,
            state: 'CO',
            signal_date: item.pubDate ? new Date(item.pubDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            status: 'NEW',
            score: search.priority === 'CRITICAL' ? 95 : search.priority === 'HOT' ? 85 : 70,
            priority: search.priority,
            urgency: search.priority === 'CRITICAL' ? 'immediate' : 'this_week',
            revenue,
            signals: ['CRAIGSLIST', search.category.toUpperCase()],
            notes: item.description?.substring(0, 200) || '',
            link: item.link,
            sms: `Hi! Saw your Craigslist post. HandsOn does ${search.trade} in ${location} - fast, reliable, fair prices. Free quote: (720) 899-0383`
          };

          leads.push(lead);
        }

        // Rate limit between requests
        await new Promise(r => setTimeout(r, 1000));

      } catch (e) {
        if (!e.message.includes('404')) {
          console.log(`   ⚠️ ${region}/${search.category}: ${e.message}`);
        }
      }
    }
  }

  // Save leads
  if (leads.length > 0) {
    const { error } = await supabase.from('handson_leads').upsert(leads);
    if (error) {
      console.log(`   ❌ Save error: ${error.message}`);
    } else {
      console.log(`   ✅ Found ${leads.length} Craigslist leads`);
    }
  } else {
    console.log('   No new Craigslist leads');
  }

  return leads;
}

module.exports = { scrapeCraigslistRSS };
