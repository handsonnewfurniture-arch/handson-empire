/**
 * HANDSON EMPIRE - COMMUNICATIONS API ROUTES
 *
 * Endpoints:
 *   GET  /api/comms                 - List all conversations
 *   GET  /api/comms/:phone          - Get conversation thread for phone
 *   POST /api/comms/send            - Send SMS
 *   POST /api/comms/webhook/sms     - Twilio inbound SMS webhook
 *   POST /api/comms/webhook/vapi    - Vapi call completion webhook
 */

const express = require('express');
const router = express.Router();
const {
  logInboundSMS,
  logCallComplete,
  getConversation,
  getAllConversations,
  sendSMS
} = require('../services/comms');

// =============================================================================
// GET /api/comms - List all conversations
// =============================================================================

router.get('/', async (req, res) => {
  try {
    const conversations = await getAllConversations({ limit: 100 });
    res.json({
      success: true,
      count: conversations.length,
      conversations
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// =============================================================================
// GET /api/comms/:phone - Get conversation thread
// =============================================================================

router.get('/:phone', async (req, res) => {
  try {
    // Clean phone number
    let phone = req.params.phone.replace(/\D/g, '');
    if (phone.length === 10) phone = '1' + phone;
    phone = '+' + phone;

    const messages = await getConversation(phone);
    res.json({
      success: true,
      phone,
      count: messages.length,
      messages
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// =============================================================================
// POST /api/comms/send - Send SMS
// =============================================================================

router.post('/send', async (req, res) => {
  try {
    const { to, body, leadId, customerName } = req.body;

    if (!to || !body) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: to, body'
      });
    }

    // Format phone number
    let phone = to.replace(/\D/g, '');
    if (phone.length === 10) phone = '1' + phone;
    phone = '+' + phone;

    const result = await sendSMS({ to: phone, body, leadId, customerName });
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// =============================================================================
// POST /api/comms/webhook/sms - Twilio Inbound SMS Webhook
// =============================================================================
// Configure in Twilio: https://console.twilio.com/phone-numbers
// Set webhook URL to: https://your-domain.com/api/comms/webhook/sms

router.post('/webhook/sms', async (req, res) => {
  try {
    const { From, Body, MessageSid } = req.body;

    console.log(`📥 Inbound SMS from ${From}: ${Body}`);

    await logInboundSMS({
      from: From,
      body: Body,
      messageSid: MessageSid
    });

    // Respond with empty TwiML (acknowledge receipt)
    res.type('text/xml');
    res.send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
  } catch (err) {
    console.error('SMS webhook error:', err.message);
    res.status(500).send('Error');
  }
});

// =============================================================================
// POST /api/comms/webhook/vapi - Vapi Call Completion Webhook
// =============================================================================
// Configure in Vapi: https://dashboard.vapi.ai
// Set server URL to: https://your-domain.com/api/comms/webhook/vapi

router.post('/webhook/vapi', async (req, res) => {
  try {
    const { message } = req.body;

    // Vapi sends different message types
    if (message?.type === 'end-of-call-report') {
      const {
        call,
        transcript,
        summary,
        recordingUrl
      } = message;

      console.log(`📞 Call completed: ${call?.id}`);

      // Parse outcome from transcript tags if present
      let outcome = 'COMPLETED';
      if (transcript?.includes('BOOKING_CONFIRMED')) outcome = 'BOOKING_CONFIRMED';
      else if (transcript?.includes('FOLLOW_UP_SCHEDULED')) outcome = 'FOLLOW_UP_SCHEDULED';
      else if (transcript?.includes('NOT_BOOKED')) outcome = 'NOT_BOOKED';

      await logCallComplete({
        callId: call?.id,
        transcript: transcript,
        duration: call?.duration,
        outcome,
        summary,
        recordingUrl
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Vapi webhook error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// =============================================================================
// GET /api/comms/unread - Get unread message count
// =============================================================================

router.get('/stats/unread', async (req, res) => {
  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
    );

    const { count, error } = await supabase
      .from('handson_comms')
      .select('*', { count: 'exact', head: true })
      .eq('direction', 'inbound')
      .is('read_at', null);

    if (error) throw error;

    res.json({ success: true, unread: count });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
