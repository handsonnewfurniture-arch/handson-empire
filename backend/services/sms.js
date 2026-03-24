// ══════════════════════════════════════════════════════════════════════════════
// SMS SERVICE - Twilio OTP Authentication
// ══════════════════════════════════════════════════════════════════════════════

const twilio = require('twilio');

// Initialize Twilio client
const client = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

const TWILIO_PHONE = process.env.TWILIO_PHONE || '+17744687657';

/**
 * Generate a 6-digit OTP code
 */
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Send OTP code via SMS
 * @param {string} phone - Phone number (E.164 format preferred)
 * @param {string} code - 6-digit OTP code
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
async function sendOTP(phone, code) {
  // Normalize phone number
  let normalizedPhone = phone.replace(/\D/g, '');
  if (!normalizedPhone.startsWith('1') && normalizedPhone.length === 10) {
    normalizedPhone = '1' + normalizedPhone;
  }
  if (!normalizedPhone.startsWith('+')) {
    normalizedPhone = '+' + normalizedPhone;
  }

  const message = `Your HandsOn verification code is: ${code}\n\nThis code expires in 10 minutes.`;

  if (!client) {
    console.log(`📱 [DEV] SMS to ${normalizedPhone}: ${message}`);
    return { success: true, messageId: 'dev-mode' };
  }

  try {
    const result = await client.messages.create({
      body: message,
      from: TWILIO_PHONE,
      to: normalizedPhone
    });

    console.log(`📱 SMS sent to ${normalizedPhone}: ${result.sid}`);
    return { success: true, messageId: result.sid };
  } catch (error) {
    console.error(`📱 SMS error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Send job notification to customer
 */
async function sendJobNotification(phone, message) {
  let normalizedPhone = phone.replace(/\D/g, '');
  if (!normalizedPhone.startsWith('1') && normalizedPhone.length === 10) {
    normalizedPhone = '1' + normalizedPhone;
  }
  if (!normalizedPhone.startsWith('+')) {
    normalizedPhone = '+' + normalizedPhone;
  }

  if (!client) {
    console.log(`📱 [DEV] Notification to ${normalizedPhone}: ${message}`);
    return { success: true };
  }

  try {
    const result = await client.messages.create({
      body: message,
      from: TWILIO_PHONE,
      to: normalizedPhone
    });
    return { success: true, messageId: result.sid };
  } catch (error) {
    console.error(`📱 Notification error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Send job link to customer (for scraper conversion)
 */
async function sendJobLink(phone, jobId, workerName) {
  const baseUrl = process.env.APP_URL || 'https://www.handsonleads.com';
  const message = `Hi! ${workerName} from HandsOn wants to help with your service request.\n\nView details and approve: ${baseUrl}/customer/job.html?id=${jobId}\n\nReply STOP to opt out.`;

  return sendJobNotification(phone, message);
}

module.exports = {
  generateOTP,
  sendOTP,
  sendJobNotification,
  sendJobLink
};
