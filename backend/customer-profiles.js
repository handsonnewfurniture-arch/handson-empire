// ══════════════════════════════════════════════════════════════════════════════
// HANDSON EMPIRE - IDEAL CUSTOMER PROFILES (ICP)
// Source of truth for who our ideal customers are
// ══════════════════════════════════════════════════════════════════════════════

/**
 * IDEAL CUSTOMER PROFILES
 * Each profile defines:
 * - demographics: Who they are
 * - behaviors: What they're doing (triggers/signals)
 * - pain_points: What problems they have
 * - indicators: Keywords/signals that identify them
 * - value: Revenue potential and lifetime value
 * - priority: How urgently we should contact them
 */

const CUSTOMER_PROFILES = {

  // ═══════════════════════════════════════════════════════════════════════════
  // TIER 1: CRITICAL - Contact within 1 hour (Highest conversion)
  // ═══════════════════════════════════════════════════════════════════════════

  URGENT_MOVER: {
    id: 'urgent_mover',
    name: 'Urgent Mover',
    tier: 1,
    description: 'Someone who needs to move RIGHT NOW - closing on house, lease ending, eviction',
    demographics: {
      income: 'middle_to_upper',
      housing: ['homeowner_selling', 'renter_relocating'],
      life_stage: ['job_change', 'divorce', 'downsizing', 'upsizing']
    },
    behaviors: [
      'Just closed on a home (Redfin SOLD/PENDING)',
      'Lease ending this month',
      'Posted urgent help request on Reddit/Craigslist',
      'Eviction filing (forced move)'
    ],
    pain_points: [
      'Stressed about timeline',
      'May have already been ghosted by other movers',
      'Worried about hidden fees',
      'Needs reliable, fast response'
    ],
    indicators: {
      keywords: ['asap', 'urgent', 'today', 'tomorrow', 'this weekend', 'emergency',
                 'closing', 'move out date', 'lease ends', 'need movers now'],
      sources: ['Redfin SOLD', 'Redfin PENDING', 'Eviction Court', 'Craigslist Gigs'],
      signals: ['DIRECT_REQUEST', 'URGENT', 'UNDER_CONTRACT', 'JUST_SOLD']
    },
    value: {
      avg_job: 450,
      lifetime: 1200,  // Repeat moves, referrals
      close_rate: 0.45  // 45% conversion
    },
    contact: {
      priority: 'CRITICAL',
      max_response_time: '1_hour',
      channel: 'phone_first',
      script: 'urgent_mover'
    }
  },

  FURNITURE_BUYER: {
    id: 'furniture_buyer',
    name: 'Online Furniture Buyer',
    tier: 1,
    description: 'Just bought furniture online (IKEA, Wayfair, Amazon) - needs assembly',
    demographics: {
      income: 'middle_class',
      housing: ['apartment', 'first_home', 'new_home'],
      tech_savvy: true
    },
    behaviors: [
      'Posting about furniture purchase',
      'Asking for assembly recommendations',
      'Searching for IKEA assembly help',
      'Frustrated with DIY attempt'
    ],
    pain_points: [
      'Instructions are confusing',
      'Missing tools or parts',
      'Physically difficult',
      'Time-consuming',
      'Already tried and failed'
    ],
    indicators: {
      keywords: ['ikea', 'wayfair', 'amazon furniture', 'assembly', 'put together',
                 'build furniture', 'need help assembling', 'furniture instructions',
                 'missing parts', 'allen wrench'],
      sources: ['Reddit', 'Craigslist', 'Nextdoor', 'Smart City Locating'],
      signals: ['FURNITURE_BUY', 'DIRECT_REQUEST', 'OPPORTUNITY']
    },
    value: {
      avg_job: 175,
      lifetime: 500,   // Repeat assembly, referrals
      close_rate: 0.55  // 55% conversion - high intent
    },
    contact: {
      priority: 'CRITICAL',
      max_response_time: '2_hours',
      channel: 'sms_first',
      script: 'assembly_helper'
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TIER 2: HOT - Contact within 4 hours (High conversion)
  // ═══════════════════════════════════════════════════════════════════════════

  NEW_RENTER: {
    id: 'new_renter',
    name: 'New Apartment Renter',
    tier: 2,
    description: 'Just signed a lease - needs move-in help and furniture assembly',
    demographics: {
      age: '22-35',
      income: 'entry_to_middle',
      housing: 'renter',
      life_stage: ['first_apartment', 'job_relocation', 'roommate_change']
    },
    behaviors: [
      'Working with apartment locator (Smart City)',
      'Posting about new apartment',
      'Searching for move-in services',
      'Buying furniture for new place'
    ],
    pain_points: [
      'Limited budget but needs help',
      'No truck or equipment',
      'New to area, no connections',
      'Tight move-in window'
    ],
    indicators: {
      keywords: ['new apartment', 'just signed lease', 'moving in', 'first apartment',
                 'new place', 'apartment locator', 'move in date'],
      sources: ['Smart City Locating', 'Apartments.com', 'Reddit', 'University Housing'],
      signals: ['NEW_LEASE', 'RENTAL', 'MOVING_SIGNAL', 'APARTMENT_LOCATOR']
    },
    value: {
      avg_job: 280,
      lifetime: 800,
      close_rate: 0.40
    },
    contact: {
      priority: 'HOT',
      max_response_time: '4_hours',
      channel: 'sms_first',
      script: 'new_renter'
    }
  },

  HOME_SELLER: {
    id: 'home_seller',
    name: 'Home Seller (Pre-Listing)',
    tier: 2,
    description: 'Preparing home to sell - needs repairs, cleaning, staging help',
    demographics: {
      income: 'middle_to_upper',
      housing: 'homeowner',
      life_stage: ['upsizing', 'downsizing', 'relocating']
    },
    behaviors: [
      'Home listed as COMING SOON or ACTIVE on Redfin',
      'Getting pre-listing repairs done',
      'Staging home for showings',
      'Deep cleaning before listing'
    ],
    pain_points: [
      'Want top dollar for home',
      'Need quick turnaround on repairs',
      'Staging is expensive',
      'Juggling prep while living there'
    ],
    indicators: {
      keywords: ['selling home', 'listing soon', 'getting ready to sell', 'pre-listing',
                 'staging', 'repairs before selling', 'curb appeal'],
      sources: ['Redfin COMING SOON', 'Redfin ACTIVE', 'City Permits'],
      signals: ['FOR_SALE', 'COMING_SOON', 'REAL_ESTATE']
    },
    value: {
      avg_job: 650,
      lifetime: 1500,
      close_rate: 0.35
    },
    contact: {
      priority: 'HOT',
      max_response_time: '4_hours',
      channel: 'phone_first',
      script: 'home_seller'
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TIER 3: WARM - Contact within 24 hours (Moderate conversion)
  // ═══════════════════════════════════════════════════════════════════════════

  HOME_BUYER: {
    id: 'home_buyer',
    name: 'New Home Buyer',
    tier: 3,
    description: 'Just bought a home - will need move-in services over next 30-60 days',
    demographics: {
      income: 'middle_to_upper',
      housing: 'new_homeowner',
      life_stage: ['first_home', 'upgrade', 'relocation']
    },
    behaviors: [
      'Home showing as SOLD on Redfin',
      'Posting about new home purchase',
      'Planning move timeline'
    ],
    pain_points: [
      'Coordinating closing and move',
      'Need reliable movers',
      'Have valuable/fragile items',
      'Want smooth transition'
    ],
    indicators: {
      keywords: ['new home', 'just bought', 'closing soon', 'first home',
                 'homeowner', 'new house'],
      sources: ['Redfin SOLD', 'Reddit', 'Zillow'],
      signals: ['JUST_SOLD', 'MOVING_SIGNAL', 'REAL_ESTATE']
    },
    value: {
      avg_job: 500,
      lifetime: 2000,
      close_rate: 0.30
    },
    contact: {
      priority: 'WARM',
      max_response_time: '24_hours',
      channel: 'email_first',
      script: 'home_buyer'
    }
  },

  CORPORATE_RELOCATION: {
    id: 'corporate_relocation',
    name: 'Corporate Relocator',
    tier: 3,
    description: 'Employee relocating for work - company may be paying',
    demographics: {
      income: 'upper_middle',
      employment: 'professional',
      life_stage: 'job_change'
    },
    behaviors: [
      'WARN Act filing (mass layoff/relocation)',
      'Posting about job relocation',
      'Company relocating employees'
    ],
    pain_points: [
      'Tight timeline from employer',
      'Need reliable documentation for reimbursement',
      'Quality matters more than price',
      'Stress of new job + move'
    ],
    indicators: {
      keywords: ['relocating for work', 'job transfer', 'corporate move', 'company paying',
                 'relocation package', 'new job'],
      sources: ['WARN Act Filing', 'Reddit', 'LinkedIn'],
      signals: ['WARN_ACT', 'CORPORATE', 'RELOCATION']
    },
    value: {
      avg_job: 800,
      lifetime: 800,
      close_rate: 0.35
    },
    contact: {
      priority: 'WARM',
      max_response_time: '24_hours',
      channel: 'email_first',
      script: 'corporate'
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TIER 4: NURTURE - Contact within 48 hours (Long-term conversion)
  // ═══════════════════════════════════════════════════════════════════════════

  STUDENT_MOVER: {
    id: 'student_mover',
    name: 'College Student',
    tier: 4,
    description: 'Student moving to/from campus housing',
    demographics: {
      age: '18-24',
      income: 'student_budget',
      housing: 'dorm_or_apartment',
      life_stage: 'student'
    },
    behaviors: [
      'University housing cycles (Aug/Dec/May)',
      'Posting about dorm move-in/out',
      'Looking for cheap help'
    ],
    pain_points: [
      'Very limited budget',
      'No vehicle',
      'Parents may be paying',
      'Timing around finals/breaks'
    ],
    indicators: {
      keywords: ['dorm', 'college', 'university', 'student', 'campus', 'freshman',
                 'move out', 'summer storage'],
      sources: ['CU Boulder Housing', 'DU Housing', 'University Housing', 'Reddit'],
      signals: ['UNIVERSITY', 'STUDENT', 'SEASONAL']
    },
    value: {
      avg_job: 150,
      lifetime: 600,  // Future moves after graduation
      close_rate: 0.25
    },
    contact: {
      priority: 'NURTURE',
      max_response_time: '48_hours',
      channel: 'sms_first',
      script: 'student'
    }
  },

  PROPERTY_MANAGER: {
    id: 'property_manager',
    name: 'Property Manager / Landlord',
    tier: 2,
    description: 'Manages multiple units - repeat business potential',
    demographics: {
      role: 'business',
      units: 'multiple',
      decision_maker: true
    },
    behaviors: [
      'Posting about unit turnover',
      'Multiple move-outs/move-ins',
      'Regular maintenance needs',
      'Apartment locator referral partner'
    ],
    pain_points: [
      'Need reliable vendors',
      'Quick turnaround between tenants',
      'Consistent quality across units',
      'Billing/invoicing for accounting'
    ],
    indicators: {
      keywords: ['property manager', 'landlord', 'apartment complex', 'hoa',
                 'unit turnover', 'tenant', 'rental property', 'multiple units'],
      sources: ['Smart City Locating', 'Apartments.com', 'Nextdoor'],
      signals: ['PARTNER', 'COMMERCIAL', 'HIGH_VOLUME', 'PROPERTY_MANAGER']
    },
    value: {
      avg_job: 400,
      lifetime: 10000,  // Ongoing relationship
      close_rate: 0.30
    },
    contact: {
      priority: 'HOT',
      max_response_time: '4_hours',
      channel: 'phone_first',
      script: 'property_manager'
    }
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// LEAD CATEGORIZATION
// ══════════════════════════════════════════════════════════════════════════════

const LEAD_CATEGORIES = {
  // Service-based categories
  ASSEMBLY: {
    name: 'Furniture Assembly',
    trades: ['assembly'],
    avg_value: 175,
    profiles: ['FURNITURE_BUYER', 'NEW_RENTER', 'HOME_BUYER']
  },
  MOVING: {
    name: 'Moving & Delivery',
    trades: ['moving', 'movers', 'delivery'],
    avg_value: 400,
    profiles: ['URGENT_MOVER', 'NEW_RENTER', 'HOME_BUYER', 'STUDENT_MOVER', 'CORPORATE_RELOCATION']
  },
  HANDYMAN: {
    name: 'Handyman & Repairs',
    trades: ['handyman', 'repair', 'tvmount'],
    avg_value: 200,
    profiles: ['HOME_SELLER', 'HOME_BUYER', 'PROPERTY_MANAGER']
  },
  HOME_PREP: {
    name: 'Home Prep (Selling)',
    trades: ['cleaning', 'painting', 'landscaping', 'powerwash'],
    avg_value: 500,
    profiles: ['HOME_SELLER']
  },

  // Status-based categories
  HOT_LEADS: {
    name: 'Hot Leads (Call Today)',
    min_score: 85,
    max_response: '4_hours'
  },
  WARM_LEADS: {
    name: 'Warm Leads (Call This Week)',
    min_score: 65,
    max_score: 84,
    max_response: '24_hours'
  },
  NURTURE_LEADS: {
    name: 'Nurture (Email Drip)',
    min_score: 40,
    max_score: 64,
    max_response: '48_hours'
  },
  COLD_LEADS: {
    name: 'Cold (Archive)',
    max_score: 39
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// PROFILE MATCHING ENGINE
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Match a lead to the best customer profile
 * @param {Object} lead - The lead object
 * @returns {Object} - { profile, match_score, match_reasons }
 */
function matchProfile(lead) {
  const text = `${lead.title || ''} ${lead.notes || ''} ${lead.source || ''}`.toLowerCase();
  const signals = lead.signals || [];
  const source = (lead.source || '').toLowerCase();

  let bestMatch = null;
  let bestScore = 0;
  let matchReasons = [];

  for (const [profileId, profile] of Object.entries(CUSTOMER_PROFILES)) {
    let matchScore = 0;
    const reasons = [];

    // Check keyword matches
    for (const keyword of profile.indicators.keywords) {
      if (text.includes(keyword.toLowerCase())) {
        matchScore += 15;
        reasons.push(`keyword: "${keyword}"`);
      }
    }

    // Check source matches
    for (const src of profile.indicators.sources) {
      if (source.includes(src.toLowerCase())) {
        matchScore += 25;
        reasons.push(`source: ${src}`);
      }
    }

    // Check signal matches
    for (const signal of profile.indicators.signals) {
      if (signals.includes(signal)) {
        matchScore += 20;
        reasons.push(`signal: ${signal}`);
      }
    }

    // Trade match bonus
    if (lead.trade) {
      const tradeProfiles = {
        assembly: ['FURNITURE_BUYER', 'NEW_RENTER'],
        moving: ['URGENT_MOVER', 'NEW_RENTER', 'HOME_BUYER', 'STUDENT_MOVER', 'CORPORATE_RELOCATION'],
        movers: ['URGENT_MOVER', 'NEW_RENTER', 'HOME_BUYER'],
        handyman: ['HOME_SELLER', 'PROPERTY_MANAGER'],
        delivery: ['FURNITURE_BUYER', 'URGENT_MOVER']
      };

      if (tradeProfiles[lead.trade]?.includes(profileId)) {
        matchScore += 10;
        reasons.push(`trade match: ${lead.trade}`);
      }
    }

    if (matchScore > bestScore) {
      bestScore = matchScore;
      bestMatch = profile;
      matchReasons = reasons;
    }
  }

  return {
    profile: bestMatch,
    profile_id: bestMatch?.id || 'unknown',
    match_score: bestScore,
    match_reasons: matchReasons,
    tier: bestMatch?.tier || 4,
    contact_priority: bestMatch?.contact.priority || 'NURTURE',
    max_response_time: bestMatch?.contact.max_response_time || '48_hours',
    expected_value: bestMatch?.value.avg_job || 200,
    close_rate: bestMatch?.value.close_rate || 0.15
  };
}

/**
 * Categorize a lead based on score and profile
 * @param {Object} lead - Lead with score
 * @returns {string} - Category ID
 */
function categorize(lead) {
  const score = lead.score || 50;

  if (score >= 85) return 'HOT_LEADS';
  if (score >= 65) return 'WARM_LEADS';
  if (score >= 40) return 'NURTURE_LEADS';
  return 'COLD_LEADS';
}

/**
 * Full qualification pipeline - combines scoring, profiling, and categorization
 * @param {Object} lead - Raw lead object
 * @returns {Object} - Fully qualified lead
 */
function qualifyAndCategorize(lead) {
  // Import the scorer
  const { qualifyLead } = require('./lead-scorer.js');

  // Step 1: Score the lead
  const scored = qualifyLead(lead);

  // Step 2: Match to customer profile
  const profileMatch = matchProfile({...lead, signals: scored.signals});

  // Step 3: Categorize
  const category = categorize({...lead, score: scored.score});

  // Step 4: Determine contact priority (use higher of score-based or profile-based)
  const priorityOrder = ['COLD', 'NURTURE', 'WARM', 'HOT', 'CRITICAL'];
  const scorePriority = scored.priority;
  const profilePriority = profileMatch.contact_priority;
  const finalPriority = priorityOrder.indexOf(scorePriority) > priorityOrder.indexOf(profilePriority)
    ? scorePriority : profilePriority;

  return {
    ...lead,
    // Scoring
    score: scored.score,
    qualification: scored.qualification,
    urgency: scored.urgency,
    signals: scored.signals,
    confidence: scored.confidence,

    // Profiling
    customer_profile: profileMatch.profile_id,
    profile_tier: profileMatch.tier,
    profile_match_score: profileMatch.match_score,
    profile_match_reasons: profileMatch.match_reasons,
    expected_value: profileMatch.expected_value,
    close_rate: profileMatch.close_rate,

    // Categorization
    category,
    priority: finalPriority,
    max_response_time: profileMatch.max_response_time,

    // Revenue (adjusted by profile)
    revenue: Math.round(Math.max(lead.revenue || 0, profileMatch.expected_value))
  };
}

/**
 * Batch process leads through full pipeline
 * @param {Array} leads - Array of raw leads
 * @returns {Object} - { qualified: [], byCategory: {}, byProfile: {}, stats: {} }
 */
function processLeads(leads) {
  const qualified = leads.map(qualifyAndCategorize);

  // Group by category
  const byCategory = {
    HOT_LEADS: [],
    WARM_LEADS: [],
    NURTURE_LEADS: [],
    COLD_LEADS: []
  };

  // Group by profile
  const byProfile = {};

  qualified.forEach(lead => {
    // By category
    if (byCategory[lead.category]) {
      byCategory[lead.category].push(lead);
    }

    // By profile
    if (!byProfile[lead.customer_profile]) {
      byProfile[lead.customer_profile] = [];
    }
    byProfile[lead.customer_profile].push(lead);
  });

  // Sort each category by score
  Object.keys(byCategory).forEach(cat => {
    byCategory[cat].sort((a, b) => b.score - a.score);
  });

  // Calculate stats
  const stats = {
    total: qualified.length,
    hot: byCategory.HOT_LEADS.length,
    warm: byCategory.WARM_LEADS.length,
    nurture: byCategory.NURTURE_LEADS.length,
    cold: byCategory.COLD_LEADS.length,
    total_pipeline: qualified.reduce((sum, l) => sum + (l.revenue || 0), 0),
    avg_score: Math.round(qualified.reduce((sum, l) => sum + l.score, 0) / qualified.length),
    contact_today: byCategory.HOT_LEADS.length,
    profiles_matched: Object.keys(byProfile).filter(p => p !== 'unknown').length
  };

  return {
    qualified,
    byCategory,
    byProfile,
    stats
  };
}

module.exports = {
  CUSTOMER_PROFILES,
  LEAD_CATEGORIES,
  matchProfile,
  categorize,
  qualifyAndCategorize,
  processLeads
};
