/**
 * HANDSON EMPIRE - UNIFIED COMMUNICATIONS SERVICE
 *
 * Central hub for all customer communications:
 * - SMS (inbound/outbound via Twilio)
 * - Calls (AI calls via Vapi)
 * - Emails (future)
 *
 * Everything logged to handson_comms table for unified chat view
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

// =============================================================================
// LOG OUTBOUND SMS
// =============================================================================

async function logOutboundSMS({ to, body, status, messageSid, leadId, customerName }) {
  try {
    const { data, error } = await supabase
      .from('handson_comms')
      .insert({
        customer_phone: to,
        customer_name: customerName,
        lead_id: leadId,
        channel: 'sms',
        direction: 'outbound',
        content: body,
        status: status || 'pending',
        external_id: messageSid
      })
      .select()
      .single();

    if (error) throw error;
    console.log(`📤 SMS logged: ${to}`);
    return data;
  } catch (err) {
    console.error('Failed to log outbound SMS:', err.message);
    return null;
  }
}

// =============================================================================
// LOG INBOUND SMS (called from Twilio webhook)
// =============================================================================

async function logInboundSMS({ from, body, messageSid }) {
  try {
    // Try to find existing customer/lead by phone
    const { data: lead } = await supabase
      .from('handson_leads')
      .select('id, title')
      .eq('phone', from)
      .single();

    const { data, error } = await supabase
      .from('handson_comms')
      .insert({
        customer_phone: from,
        customer_name: lead?.title?.split(' - ')[0] || null,
        lead_id: lead?.id || null,
        channel: 'sms',
        direction: 'inbound',
        content: body,
        status: 'delivered',
        external_id: messageSid
      })
      .select()
      .single();

    if (error) throw error;
    console.log(`📥 Inbound SMS logged: ${from}`);
    return data;
  } catch (err) {
    console.error('Failed to log inbound SMS:', err.message);
    return null;
  }
}

// =============================================================================
// LOG AI CALL (called when Vapi call starts)
// =============================================================================

async function logCallStart({ to, leadId, agentName, callId }) {
  try {
    const { data, error } = await supabase
      .from('handson_comms')
      .insert({
        customer_phone: to,
        lead_id: leadId,
        channel: 'call',
        direction: 'outbound',
        content: null, // Transcript added when call ends
        status: 'pending',
        external_id: callId,
        call_agent: agentName
      })
      .select()
      .single();

    if (error) throw error;
    console.log(`📞 Call started: ${to} with ${agentName}`);
    return data;
  } catch (err) {
    console.error('Failed to log call start:', err.message);
    return null;
  }
}

// =============================================================================
// LOG CALL COMPLETION (called from Vapi webhook)
// =============================================================================

async function logCallComplete({ callId, transcript, duration, outcome, summary, recordingUrl }) {
  try {
    const { data, error } = await supabase
      .from('handson_comms')
      .update({
        content: transcript,
        summary: summary,
        status: 'delivered',
        call_duration: duration,
        call_outcome: outcome,
        recording_url: recordingUrl
      })
      .eq('external_id', callId)
      .select()
      .single();

    if (error) throw error;
    console.log(`📞 Call completed: ${callId} - ${outcome}`);
    return data;
  } catch (err) {
    console.error('Failed to log call completion:', err.message);
    return null;
  }
}

// =============================================================================
// GET CONVERSATION THREAD (all comms for a phone number)
// =============================================================================

async function getConversation(phone) {
  try {
    const { data, error } = await supabase
      .from('handson_comms')
      .select('*')
      .eq('customer_phone', phone)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Failed to get conversation:', err.message);
    return [];
  }
}

// =============================================================================
// GET ALL CONVERSATIONS (grouped by customer)
// =============================================================================

async function getAllConversations({ limit = 50 } = {}) {
  try {
    // Get latest message per phone number
    const { data, error } = await supabase
      .from('handson_comms')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    // Group by phone
    const grouped = {};
    for (const msg of data || []) {
      const phone = msg.customer_phone;
      if (!grouped[phone]) {
        grouped[phone] = {
          phone,
          name: msg.customer_name,
          lastMessage: msg,
          messages: []
        };
      }
      grouped[phone].messages.push(msg);
    }

    return Object.values(grouped).sort((a, b) =>
      new Date(b.lastMessage.created_at) - new Date(a.lastMessage.created_at)
    );
  } catch (err) {
    console.error('Failed to get conversations:', err.message);
    return [];
  }
}

// =============================================================================
// SEND SMS (with logging)
// =============================================================================

async function sendSMS({ to, body, leadId, customerName }) {
  const twilio = require('twilio');
  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

  // Use toll-free if available, otherwise default
  const fromNumber = process.env.TWILIO_TOLLFREE || process.env.TWILIO_PHONE;

  try {
    const message = await client.messages.create({
      body,
      from: fromNumber,
      to
    });

    // Log to unified comms
    await logOutboundSMS({
      to,
      body,
      status: message.status,
      messageSid: message.sid,
      leadId,
      customerName
    });

    return { success: true, sid: message.sid, status: message.status };
  } catch (err) {
    console.error('SMS send failed:', err.message);

    // Still log the failed attempt
    await logOutboundSMS({
      to,
      body,
      status: 'failed',
      messageSid: null,
      leadId,
      customerName
    });

    return { success: false, error: err.message };
  }
}

module.exports = {
  logOutboundSMS,
  logInboundSMS,
  logCallStart,
  logCallComplete,
  getConversation,
  getAllConversations,
  sendSMS
};
