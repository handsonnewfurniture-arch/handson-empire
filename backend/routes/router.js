/**
 * HANDSON EMPIRE - ROUTER API ROUTES
 *
 * Exposes the AI Lead Router functionality via REST API
 *
 * Endpoints:
 *   POST /api/router/classify    - Classify a lead without making a call
 *   POST /api/router/route       - Classify and trigger a call
 *   GET  /api/router/agents      - List all available agents
 *   GET  /api/router/agents/:id  - Get specific agent details
 */

const express = require('express');
const router = express.Router();
const {
  AGENTS,
  classifyByKeywords,
  classifyLead,
  triggerCall,
  routeLead
} = require('../services/router');

// =============================================================================
// GET /api/router/agents - List all agents
// =============================================================================

router.get('/agents', (req, res) => {
  const agents = Object.entries(AGENTS).map(([type, agent]) => ({
    type,
    id: agent.id,
    name: agent.name,
    specialty: agent.specialty,
    keywordCount: agent.keywords.length
  }));

  res.json({
    success: true,
    count: agents.length,
    agents
  });
});

// =============================================================================
// GET /api/router/agents/:type - Get specific agent details
// =============================================================================

router.get('/agents/:type', (req, res) => {
  const { type } = req.params;
  const agent = AGENTS[type];

  if (!agent) {
    return res.status(404).json({
      success: false,
      error: `Unknown agent type: ${type}`,
      availableTypes: Object.keys(AGENTS)
    });
  }

  res.json({
    success: true,
    agent: {
      type,
      ...agent
    }
  });
});

// =============================================================================
// POST /api/router/classify - Classify a lead (no call)
// =============================================================================

router.post('/classify', async (req, res) => {
  try {
    const { description, useAI = false } = req.body;

    if (!description) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: description'
      });
    }

    const agentType = await classifyLead(description, {
      useAI,
      openaiKey: process.env.OPENAI_API_KEY
    });

    const agent = AGENTS[agentType];

    res.json({
      success: true,
      classification: agentType,
      agent: {
        name: agent.name,
        specialty: agent.specialty,
        id: agent.id
      },
      description
    });

  } catch (error) {
    console.error('Classification error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// =============================================================================
// POST /api/router/route - Classify and trigger a call
// =============================================================================

router.post('/route', async (req, res) => {
  try {
    const {
      phone,
      description,
      name,
      id,
      source,
      useAI = false,
      dryRun = false
    } = req.body;

    // Validate required fields
    if (!phone) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: phone'
      });
    }

    if (!description) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: description'
      });
    }

    const result = await routeLead(
      { phone, description, name, id, source },
      { useAI, dryRun }
    );

    res.json(result);

  } catch (error) {
    console.error('Routing error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// =============================================================================
// POST /api/router/call - Trigger call to specific agent (skip classification)
// =============================================================================

router.post('/call', async (req, res) => {
  try {
    const {
      phone,
      agentType,
      name,
      id,
      source,
      description
    } = req.body;

    // Validate required fields
    if (!phone) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: phone'
      });
    }

    if (!agentType) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: agentType'
      });
    }

    if (!AGENTS[agentType]) {
      return res.status(400).json({
        success: false,
        error: `Unknown agent type: ${agentType}`,
        availableTypes: Object.keys(AGENTS)
      });
    }

    const result = await triggerCall(phone, agentType, {
      name,
      id,
      source,
      description
    });

    res.json(result);

  } catch (error) {
    console.error('Call trigger error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// =============================================================================
// GET /api/router/test - Quick test endpoint
// =============================================================================

router.get('/test', (req, res) => {
  const testDescriptions = [
    'I need someone to assemble my IKEA MALM dresser',
    'Moving from apartment to house, need help loading truck',
    'Need my 65 inch TV mounted on the wall',
    'Looking for help with a pool table move'
  ];

  const results = testDescriptions.map(desc => ({
    description: desc,
    classification: classifyByKeywords(desc),
    agent: AGENTS[classifyByKeywords(desc)].name
  }));

  res.json({
    success: true,
    message: 'Router classification test',
    results
  });
});

module.exports = router;
