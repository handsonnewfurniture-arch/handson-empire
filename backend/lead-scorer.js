// ══════════════════════════════════════════════════════════════════════════════
// HANDSON EMPIRE - ADVANCED LEAD QUALIFICATION ENGINE
// Scores leads based on multiple signals for better prioritization
// ══════════════════════════════════════════════════════════════════════════════

// Revenue estimates by trade (average job value)
const TRADE_REVENUE = {
  assembly: 150,
  moving: 350,
  delivery: 100,
  handyman: 200,
  junk: 200,
  cleaning: 175,
  painting: 500,
  tvmount: 125,
  garage: 300,
  landscaping: 400,
  fencing: 2500,
  gutters: 250,
  powerwash: 300,
  electrical: 350,
  plumbing: 300,
  hvac: 500,
  roofing: 5000,
  flooring: 2000,
  appliance: 200,
  solar: 15000,
  dumpster: 400
};

// Urgency keywords and their scores
const URGENCY_SIGNALS = {
  immediate: ['asap', 'urgent', 'emergency', 'today', 'now', 'immediately', 'right away', 'same day'],
  high: ['this week', 'soon', 'quick', 'fast', 'rush', 'need help', 'desperate'],
  medium: ['next week', 'whenever', 'available', 'looking for'],
  low: ['eventually', 'sometime', 'no rush', 'thinking about']
};

// Quality signals that increase score
const QUALITY_SIGNALS = {
  has_phone: 20,
  has_email: 10,
  has_address: 15,
  has_budget: 15,
  direct_request: 25,    // "I need", "looking for", "hiring"
  specific_job: 10,      // Detailed description
  repeat_customer: 30,
  referral: 25,
  commercial: 20,        // Business/commercial job
  multi_unit: 15         // Apartment complex, HOA, etc.
};

// Negative signals that decrease score
const NEGATIVE_SIGNALS = {
  lowball: -20,          // "cheapest", "lowest price"
  tire_kicker: -15,      // "just browsing", "getting quotes"
  diy_failed: -5,        // Can be good or bad
  competitor: -30,       // Another company fishing
  spam_patterns: -50
};

// High-value keywords
const HIGH_VALUE_KEYWORDS = [
  'commercial', 'business', 'office', 'restaurant', 'hotel',
  'apartment complex', 'property manager', 'landlord', 'hoa',
  'multiple', 'whole house', 'full service', 'complete'
];

// Low-value / problematic keywords
const LOW_VALUE_KEYWORDS = [
  'free estimate only', 'just looking', 'cheapest', 'lowest price',
  'budget', 'discount', 'cheap', 'bargain'
];

/**
 * Advanced lead scoring function
 * @param {Object} lead - The lead object
 * @returns {Object} - { score, priority, qualification, signals, revenue }
 */
function qualifyLead(lead) {
  let score = 50; // Base score
  const signals = [];
  const text = `${lead.title || ''} ${lead.notes || ''} ${lead.description || ''}`.toLowerCase();

  // ═══ CONTACT INFO SCORING ═══
  if (lead.phone) {
    score += QUALITY_SIGNALS.has_phone;
    signals.push('HAS_PHONE');
  }
  if (lead.email) {
    score += QUALITY_SIGNALS.has_email;
    signals.push('HAS_EMAIL');
  }
  if (lead.address) {
    score += QUALITY_SIGNALS.has_address;
    signals.push('HAS_ADDRESS');
  }

  // ═══ SIGNAL TYPE SCORING ═══
  if (lead.signal_type === 'DIRECT_REQUEST' || lead.signal_type === 'DIRECT_AD') {
    score += QUALITY_SIGNALS.direct_request;
    signals.push('DIRECT_REQUEST');
  }

  // ═══ URGENCY SCORING ═══
  let urgency = 'standard';
  for (const keyword of URGENCY_SIGNALS.immediate) {
    if (text.includes(keyword)) {
      score += 25;
      urgency = 'immediate';
      signals.push('URGENT');
      break;
    }
  }
  if (urgency === 'standard') {
    for (const keyword of URGENCY_SIGNALS.high) {
      if (text.includes(keyword)) {
        score += 15;
        urgency = 'high';
        signals.push('HIGH_URGENCY');
        break;
      }
    }
  }

  // ═══ HIGH VALUE KEYWORDS ═══
  for (const keyword of HIGH_VALUE_KEYWORDS) {
    if (text.includes(keyword)) {
      score += 15;
      signals.push('HIGH_VALUE');
      break;
    }
  }

  // ═══ LOW VALUE / NEGATIVE KEYWORDS ═══
  for (const keyword of LOW_VALUE_KEYWORDS) {
    if (text.includes(keyword)) {
      score -= 10;
      signals.push('PRICE_SENSITIVE');
      break;
    }
  }

  // ═══ BUDGET MENTIONED ═══
  const budgetMatch = text.match(/\$(\d+(?:,\d{3})*)/);
  if (budgetMatch) {
    const budget = parseInt(budgetMatch[1].replace(',', ''));
    score += QUALITY_SIGNALS.has_budget;
    signals.push(`BUDGET_$${budget}`);

    // Bonus for high budgets
    if (budget > 1000) score += 10;
    if (budget > 5000) score += 15;
  }

  // ═══ TRADE-SPECIFIC SCORING ═══
  const tradeRevenue = TRADE_REVENUE[lead.trade] || 200;

  // Higher value trades get bonus
  if (tradeRevenue >= 1000) {
    score += 10;
    signals.push('HIGH_VALUE_TRADE');
  }
  if (tradeRevenue >= 5000) {
    score += 10;
    signals.push('PREMIUM_TRADE');
  }

  // ═══ SOURCE QUALITY ═══
  const source = (lead.source || '').toLowerCase();
  if (source.includes('referral')) {
    score += QUALITY_SIGNALS.referral;
    signals.push('REFERRAL');
  }
  if (source.includes('google') || source.includes('yelp')) {
    score += 10; // High intent platforms
    signals.push('HIGH_INTENT_PLATFORM');
  }

  // ═══ SPAM DETECTION ═══
  const spamPatterns = [
    /\b(viagra|casino|crypto|nft|bitcoin)\b/i,
    /\b(click here|act now|limited time)\b/i,
    /(.)\1{5,}/, // Repeated characters
  ];
  for (const pattern of spamPatterns) {
    if (pattern.test(text)) {
      score += NEGATIVE_SIGNALS.spam_patterns;
      signals.push('SPAM_DETECTED');
      break;
    }
  }

  // ═══ CALCULATE PRIORITY ═══
  let priority = 'COLD';
  let qualification = 'UNQUALIFIED';

  if (score >= 95) {
    priority = 'CRITICAL';
    qualification = 'HOT_LEAD';
  } else if (score >= 80) {
    priority = 'HOT';
    qualification = 'QUALIFIED';
  } else if (score >= 65) {
    priority = 'WARM';
    qualification = 'INTERESTED';
  } else if (score >= 50) {
    priority = 'COOL';
    qualification = 'NURTURE';
  } else {
    priority = 'COLD';
    qualification = 'LOW_PRIORITY';
  }

  // ═══ ESTIMATE REVENUE ═══
  let revenue = lead.revenue || tradeRevenue;

  // Adjust revenue based on signals
  if (signals.includes('HIGH_VALUE')) revenue *= 1.5;
  if (signals.includes('COMMERCIAL')) revenue *= 2;
  if (signals.includes('PRICE_SENSITIVE')) revenue *= 0.7;

  // Cap score at 100
  score = Math.min(100, Math.max(0, score));

  return {
    score: Math.round(score),
    priority,
    qualification,
    urgency,
    signals,
    revenue: Math.round(revenue),
    confidence: score >= 70 ? 'HIGH' : score >= 50 ? 'MEDIUM' : 'LOW'
  };
}

/**
 * Batch qualify leads
 * @param {Array} leads - Array of lead objects
 * @returns {Array} - Leads with qualification data, sorted by score
 */
function qualifyLeads(leads) {
  return leads
    .map(lead => {
      const qual = qualifyLead(lead);
      return {
        ...lead,
        score: qual.score,
        priority: qual.priority,
        qualification: qual.qualification,
        urgency: qual.urgency,
        signals: qual.signals,
        revenue: qual.revenue,
        confidence: qual.confidence
      };
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * Filter leads by minimum qualification
 * @param {Array} leads - Array of lead objects
 * @param {string} minQualification - Minimum qualification level
 * @returns {Array} - Filtered leads
 */
function filterQualifiedLeads(leads, minQualification = 'INTERESTED') {
  const qualLevels = ['LOW_PRIORITY', 'NURTURE', 'INTERESTED', 'QUALIFIED', 'HOT_LEAD'];
  const minIndex = qualLevels.indexOf(minQualification);

  return leads.filter(lead => {
    const qual = qualifyLead(lead);
    return qualLevels.indexOf(qual.qualification) >= minIndex;
  });
}

module.exports = {
  qualifyLead,
  qualifyLeads,
  filterQualifiedLeads,
  TRADE_REVENUE,
  URGENCY_SIGNALS,
  QUALITY_SIGNALS
};
