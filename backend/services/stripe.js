// ══════════════════════════════════════════════════════════════════════════════
// STRIPE SERVICE - Payment Processing & Connect
// ══════════════════════════════════════════════════════════════════════════════

const Stripe = require('stripe');

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

const PLATFORM_FEE_PERCENT = 8; // 8% platform fee
const APP_URL = process.env.APP_URL || 'https://www.handsonleads.com';

/**
 * Create Stripe Connect Express account for worker
 */
async function createConnectAccount(workerId, email) {
  if (!stripe) {
    console.log('[DEV] Stripe not configured - mock Connect account');
    return { success: true, accountId: `acct_dev_${workerId}` };
  }

  try {
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'US',
      email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true }
      },
      business_type: 'individual',
      metadata: {
        worker_id: workerId
      }
    });

    return { success: true, accountId: account.id };
  } catch (error) {
    console.error('Stripe Connect error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Generate Stripe Connect onboarding link
 */
async function createOnboardingLink(accountId, workerId) {
  if (!stripe) {
    console.log('[DEV] Stripe not configured - mock onboarding link');
    return { success: true, url: `${APP_URL}/worker/earnings.html?onboarded=true` };
  }

  try {
    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${APP_URL}/worker/earnings.html?refresh=true`,
      return_url: `${APP_URL}/worker/earnings.html?onboarded=true`,
      type: 'account_onboarding'
    });

    return { success: true, url: link.url };
  } catch (error) {
    console.error('Onboarding link error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Check if Connect account is fully onboarded
 */
async function checkAccountStatus(accountId) {
  if (!stripe) {
    return { success: true, onboarded: true, payoutsEnabled: true };
  }

  try {
    const account = await stripe.accounts.retrieve(accountId);
    return {
      success: true,
      onboarded: account.details_submitted,
      payoutsEnabled: account.payouts_enabled,
      chargesEnabled: account.charges_enabled
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Create customer for payment
 */
async function createCustomer(customerId, email, phone) {
  if (!stripe) {
    return { success: true, stripeCustomerId: `cus_dev_${customerId}` };
  }

  try {
    const customer = await stripe.customers.create({
      email,
      phone,
      metadata: {
        customer_id: customerId
      }
    });

    return { success: true, stripeCustomerId: customer.id };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Create payment intent with platform fee
 * @param {number} amount - Amount in cents
 * @param {string} workerStripeAccountId - Worker's Connect account
 * @param {string} description - Payment description
 */
async function createPaymentIntent(amount, workerStripeAccountId, description, metadata = {}) {
  if (!stripe) {
    console.log(`[DEV] Mock payment intent: $${(amount/100).toFixed(2)}`);
    return {
      success: true,
      clientSecret: 'dev_secret_' + Date.now(),
      paymentIntentId: 'pi_dev_' + Date.now(),
      platformFee: Math.round(amount * PLATFORM_FEE_PERCENT / 100),
      workerPayout: amount - Math.round(amount * PLATFORM_FEE_PERCENT / 100)
    };
  }

  const platformFee = Math.round(amount * PLATFORM_FEE_PERCENT / 100);

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      description,
      application_fee_amount: platformFee,
      transfer_data: {
        destination: workerStripeAccountId
      },
      metadata
    });

    return {
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      platformFee,
      workerPayout: amount - platformFee
    };
  } catch (error) {
    console.error('Payment intent error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Retrieve payment intent status
 */
async function getPaymentIntent(paymentIntentId) {
  if (!stripe || paymentIntentId.startsWith('pi_dev_')) {
    return { success: true, status: 'succeeded' };
  }

  try {
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    return {
      success: true,
      status: intent.status,
      amount: intent.amount,
      metadata: intent.metadata
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Create Stripe dashboard login link for worker
 */
async function createDashboardLink(accountId) {
  if (!stripe) {
    return { success: true, url: 'https://dashboard.stripe.com' };
  }

  try {
    const link = await stripe.accounts.createLoginLink(accountId);
    return { success: true, url: link.url };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Refund a payment
 */
async function refundPayment(paymentIntentId, amount = null) {
  if (!stripe || paymentIntentId.startsWith('pi_dev_')) {
    return { success: true, refundId: 'ref_dev_' + Date.now() };
  }

  try {
    const refundData = { payment_intent: paymentIntentId };
    if (amount) refundData.amount = amount;

    const refund = await stripe.refunds.create(refundData);
    return { success: true, refundId: refund.id };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

module.exports = {
  createConnectAccount,
  createOnboardingLink,
  checkAccountStatus,
  createCustomer,
  createPaymentIntent,
  getPaymentIntent,
  createDashboardLink,
  refundPayment,
  PLATFORM_FEE_PERCENT
};
