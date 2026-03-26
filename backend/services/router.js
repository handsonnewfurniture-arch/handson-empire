/**
 * HANDSON EMPIRE - AI LEAD ROUTER
 *
 * Takes incoming leads, classifies the job type, and routes to the right specialist.
 *
 * Flow: Lead → Classify → Select Agent → Trigger Vapi Call
 */

const fetch = require('node-fetch');

// =============================================================================
// AGENT ROSTER - Maps specialties to Vapi Assistant IDs
// =============================================================================

const AGENTS = {
  // ASSEMBLY SPECIALISTS
  assembly: {
    id: 'aca1ceda-6cd1-4475-97ed-5fc0dc3b2554',
    name: 'Sarah',
    specialty: 'General Assembly',
    keywords: ['assemble', 'assembly', 'put together', 'furniture', 'bed frame', 'dresser', 'desk', 'bookshelf', 'wayfair', 'amazon']
  },
  ikea: {
    id: '557530d3-58c9-4337-ad9c-d872d96b5896',
    name: 'Emma',
    specialty: 'IKEA Expert',
    keywords: ['ikea', 'malm', 'kallax', 'hemnes', 'pax', 'besta', 'billy', 'lack', 'poang', 'nordli', 'tarva', 'brimnes']
  },
  office: {
    id: 'bc26fd2c-db95-4bef-977d-6583e482158b',
    name: 'Carlos',
    specialty: 'Office Furniture',
    keywords: ['office', 'standing desk', 'sit stand', 'l-shaped desk', 'executive desk', 'cubicle', 'conference table', 'ergonomic', 'uplift', 'flexispot', 'autonomous']
  },
  kids: {
    id: '7a12297d-662a-41ea-8976-c995d4db16f6',
    name: 'Nina',
    specialty: 'Kids Furniture',
    keywords: ['crib', 'nursery', 'baby', 'bunk bed', 'toddler bed', 'changing table', 'glider', 'rocker', 'kids room', 'child']
  },
  outdoor: {
    id: 'b2ed583c-173f-40bb-9cec-3b1176a1a685',
    name: 'Tony',
    specialty: 'Outdoor & Patio',
    keywords: ['patio', 'outdoor', 'grill', 'bbq', 'pergola', 'gazebo', 'fire pit', 'adirondack', 'deck', 'backyard', 'weber', 'traeger']
  },
  closets: {
    id: '94bbfd17-9536-43e0-abbe-651c59f09920',
    name: 'Jen',
    specialty: 'Closet Systems',
    keywords: ['closet', 'wardrobe', 'pax wardrobe', 'elfa', 'closetmaid', 'california closet', 'organizer', 'walk-in']
  },
  gym: {
    id: '37a78a71-b363-43d1-968e-f341b3d87786',
    name: 'Kevin',
    specialty: 'Gym Equipment',
    keywords: ['peloton', 'treadmill', 'elliptical', 'gym', 'fitness', 'exercise', 'weight bench', 'squat rack', 'power rack', 'rowing', 'bowflex', 'nordictrack']
  },

  // MOVING & HAULING
  moving: {
    id: '59d19a7b-59b4-475f-a62b-9dd43af2f28c',
    name: 'Jake',
    specialty: 'Local Moving',
    keywords: ['move', 'moving', 'relocate', 'apartment move', 'house move', 'storage unit', 'load', 'unload']
  },
  heavy_items: {
    id: 'dcef345a-90a6-4c43-87de-40904d20245b',
    name: 'Marcus',
    specialty: 'Heavy Items',
    keywords: ['piano', 'pool table', 'safe', 'gun safe', 'hot tub', 'marble', 'heavy', '500 lb', '1000 lb', 'slate']
  },
  delivery: {
    id: '2a865c7c-7ced-47df-818d-fa323fb1097c',
    name: 'Derek',
    specialty: 'Delivery & Setup',
    keywords: ['delivery', 'pickup', 'deliver', 'marketplace', 'facebook marketplace', 'craigslist', 'offerup', 'store pickup', 'costco']
  },
  junk_removal: {
    id: 'a006e7c6-cb08-476a-ab20-64434b8a8ef6',
    name: 'Ray',
    specialty: 'Junk Removal',
    keywords: ['junk', 'haul away', 'dispose', 'dump', 'trash', 'get rid of', 'removal', 'cleanout', 'estate clean']
  },
  packing: {
    id: '91e3437c-108f-4e1d-bdbf-bf6fff540344',
    name: 'Mike',
    specialty: 'Packing Services',
    keywords: ['pack', 'packing', 'boxes', 'wrap', 'moving supplies', 'bubble wrap', 'unpacking']
  },

  // INSTALLATION
  tv_mounting: {
    id: 'dd7717de-f1fc-4efb-bd97-fa8945771db1',
    name: 'Maria',
    specialty: 'TV Mounting',
    keywords: ['tv', 'television', 'mount', 'wall mount', 'soundbar', 'home theater', 'cable concealment', 'above fireplace']
  },
  shelving: {
    id: '51834e5e-79b1-47af-b0c4-b985d24239f8',
    name: 'Chris',
    specialty: 'Shelving & Storage',
    keywords: ['shelf', 'shelves', 'shelving', 'floating shelf', 'bracket', 'garage storage', 'pantry', 'wall storage']
  },
  curtains: {
    id: '2414c8c9-f44a-447f-9771-4c06876f5230',
    name: 'Dave',
    specialty: 'Curtains & Blinds',
    keywords: ['curtain', 'curtains', 'drapes', 'blinds', 'shades', 'window treatment', 'rod', 'shutters']
  },
  pictures: {
    id: '0ddd8e06-4448-411f-8899-88060c742bf5',
    name: 'Lisa',
    specialty: 'Pictures & Mirrors',
    keywords: ['picture', 'pictures', 'mirror', 'artwork', 'art', 'gallery wall', 'frame', 'hanging', 'portrait']
  },
  home_office: {
    id: 'e2aa55b4-e389-47df-b907-72cbde9ad459',
    name: 'Paul',
    specialty: 'Home Office Setup',
    keywords: ['home office', 'wfh', 'work from home', 'monitor arm', 'cable management', 'desk setup', 'dual monitor', 'docking station']
  },

  // HANDYMAN
  repairs: {
    id: '27157e25-9ab0-41db-895d-f477d807d91c',
    name: 'Luis',
    specialty: 'General Repairs',
    keywords: ['repair', 'fix', 'broken', 'door', 'drywall', 'faucet', 'leak', 'cabinet', 'hinge', 'toilet', 'caulk']
  },
  small_fixes: {
    id: 'e4a1c0cd-62c6-4606-97a3-89b5b3f394e9',
    name: 'Anna',
    specialty: 'Small Fixes',
    keywords: ['small fix', 'tighten', 'loose', 'smoke detector', 'doorbell', 'towel bar', 'squeaky', 'handle', 'knob']
  },
  odd_jobs: {
    id: 'bd4a6468-e2cf-430b-9c6f-0d8f1695b847',
    name: 'Sam',
    specialty: 'Odd Jobs',
    keywords: ['odd job', 'help', 'wait for', 'elderly', 'organize', 'rearrange', 'errand', 'miscellaneous']
  }
};

// =============================================================================
// CLASSIFICATION LOGIC
// =============================================================================

/**
 * Simple keyword-based classification (fast, no API cost)
 * Returns the best matching agent based on keyword hits
 */
function classifyByKeywords(leadDescription) {
  const description = leadDescription.toLowerCase();
  let bestMatch = null;
  let highestScore = 0;

  for (const [agentType, agent] of Object.entries(AGENTS)) {
    let score = 0;
    for (const keyword of agent.keywords) {
      if (description.includes(keyword.toLowerCase())) {
        // Longer keywords are more specific, weight them higher
        score += keyword.length;
      }
    }
    if (score > highestScore) {
      highestScore = score;
      bestMatch = agentType;
    }
  }

  return bestMatch || 'assembly'; // Default to Sarah (general assembly) if no match
}

/**
 * AI-powered classification using OpenAI (more accurate, costs money)
 * Use this for ambiguous leads or when keyword matching fails
 */
async function classifyWithAI(leadDescription, openaiKey) {
  const agentList = Object.entries(AGENTS)
    .map(([type, agent]) => `- ${type}: ${agent.name} - ${agent.specialty}`)
    .join('\n');

  const prompt = `You are a lead classifier for a home services company. Based on the lead description, determine which specialist should handle this job.

AVAILABLE SPECIALISTS:
${agentList}

LEAD DESCRIPTION:
"${leadDescription}"

Respond with ONLY the agent type (e.g., "ikea", "tv_mounting", "moving"). No explanation, just the type.`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo', // Fast and cheap for classification
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
        max_tokens: 20
      })
    });

    const data = await response.json();
    const agentType = data.choices[0].message.content.trim().toLowerCase();

    // Validate the response is a valid agent type
    if (AGENTS[agentType]) {
      return agentType;
    }

    // Fallback to keyword matching if AI returns invalid type
    console.log(`AI returned invalid type: ${agentType}, falling back to keywords`);
    return classifyByKeywords(leadDescription);

  } catch (error) {
    console.error('AI classification failed:', error);
    return classifyByKeywords(leadDescription);
  }
}

/**
 * Main classification function
 * Tries keyword matching first, uses AI for low-confidence matches
 */
async function classifyLead(leadDescription, options = {}) {
  const { useAI = false, openaiKey = null } = options;

  // Always try keyword matching first (free)
  const keywordMatch = classifyByKeywords(leadDescription);

  // Calculate confidence based on how many keywords matched
  const description = leadDescription.toLowerCase();
  const agent = AGENTS[keywordMatch];
  const matchedKeywords = agent.keywords.filter(kw => description.includes(kw.toLowerCase()));
  const confidence = matchedKeywords.length / agent.keywords.length;

  // If low confidence and AI is enabled, use AI classification
  if (confidence < 0.2 && useAI && openaiKey) {
    console.log(`Low confidence (${confidence.toFixed(2)}), using AI classification`);
    return await classifyWithAI(leadDescription, openaiKey);
  }

  return keywordMatch;
}

// =============================================================================
// VAPI CALL TRIGGER
// =============================================================================

/**
 * Trigger an outbound call using Vapi
 */
async function triggerCall(phoneNumber, agentType, leadData = {}) {
  const agent = AGENTS[agentType];

  if (!agent) {
    throw new Error(`Unknown agent type: ${agentType}`);
  }

  const vapiKey = process.env.VAPI_API_KEY;
  const vapiPhoneId = process.env.VAPI_PHONE_NUMBER_ID || '6d65f57b-be00-4fb9-91c6-6cbb42bb6648';

  if (!vapiKey) {
    throw new Error('VAPI_API_KEY not configured');
  }

  // Format phone number (ensure E.164 format)
  let formattedPhone = phoneNumber.replace(/\D/g, '');
  if (!formattedPhone.startsWith('1') && formattedPhone.length === 10) {
    formattedPhone = '1' + formattedPhone;
  }
  formattedPhone = '+' + formattedPhone;

  console.log(`Triggering call to ${formattedPhone} with agent ${agent.name} (${agent.specialty})`);

  const response = await fetch('https://api.vapi.ai/call/phone', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${vapiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      assistantId: agent.id,
      phoneNumberId: vapiPhoneId,
      customer: {
        number: formattedPhone,
        name: leadData.name || 'Customer'
      },
      metadata: {
        leadId: leadData.id,
        leadSource: leadData.source,
        jobType: agentType,
        agentName: agent.name,
        description: leadData.description
      }
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Vapi call failed: ${JSON.stringify(data)}`);
  }

  return {
    success: true,
    callId: data.id,
    agent: {
      name: agent.name,
      type: agentType,
      specialty: agent.specialty
    },
    phone: formattedPhone
  };
}

// =============================================================================
// MAIN ROUTER FUNCTION
// =============================================================================

/**
 * Route a lead to the appropriate agent and trigger a call
 *
 * @param {Object} lead - The lead data
 * @param {string} lead.phone - Customer phone number
 * @param {string} lead.description - Job description
 * @param {string} lead.name - Customer name (optional)
 * @param {string} lead.id - Lead ID (optional)
 * @param {string} lead.source - Lead source (optional)
 * @param {Object} options - Router options
 * @param {boolean} options.useAI - Use AI for classification (default: false)
 * @param {boolean} options.dryRun - Don't actually make the call (default: false)
 */
async function routeLead(lead, options = {}) {
  const { useAI = false, dryRun = false } = options;

  // Validate required fields
  if (!lead.phone) {
    throw new Error('Lead must have a phone number');
  }
  if (!lead.description) {
    throw new Error('Lead must have a description');
  }

  // Step 1: Classify the lead
  const agentType = await classifyLead(lead.description, {
    useAI,
    openaiKey: process.env.OPENAI_API_KEY
  });

  const agent = AGENTS[agentType];
  console.log(`Lead classified as: ${agentType} → ${agent.name} (${agent.specialty})`);

  // Step 2: Trigger the call (unless dry run)
  if (dryRun) {
    return {
      success: true,
      dryRun: true,
      classification: agentType,
      agent: {
        name: agent.name,
        type: agentType,
        specialty: agent.specialty,
        id: agent.id
      },
      lead
    };
  }

  const callResult = await triggerCall(lead.phone, agentType, {
    id: lead.id,
    name: lead.name,
    source: lead.source,
    description: lead.description
  });

  return {
    success: true,
    classification: agentType,
    ...callResult,
    lead
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  AGENTS,
  classifyByKeywords,
  classifyWithAI,
  classifyLead,
  triggerCall,
  routeLead
};
