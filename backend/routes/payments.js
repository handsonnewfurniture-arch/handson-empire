// ══════════════════════════════════════════════════════════════════════════════
// PAYMENTS ROUTES - Stripe Connect Integration
// ══════════════════════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { requireAuth, requireCustomer, requireWorker } = require('../middleware/auth');
const stripe = require('../services/stripe');
const { sendJobNotification } = require('../services/sms');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY
);

// WebSocket broadcast
let broadcast = () => {};
function setBroadcast(fn) { broadcast = fn; }

/**
 * POST /api/payments/create-intent
 * Create Stripe payment intent for job
 */
router.post('/create-intent', requireCustomer, async (req, res) => {
  try {
    const { job_id } = req.body;

    if (!job_id) {
      return res.status(400).json({ error: 'Job ID required' });
    }

    // Get job with worker info
    const { data: job, error: jobError } = await supabase
      .from('handson_jobs')
      .select('*, worker:handson_workers(id, name, stripe_account_id, stripe_onboarded)')
      .eq('id', job_id)
      .eq('customer_id', req.user.id)
      .single();

    if (jobError || !job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.status !== 'completed') {
      return res.status(400).json({ error: 'Job must be completed before payment' });
    }

    if (!job.total_price) {
      return res.status(400).json({ error: 'Job price not set' });
    }

    if (!job.worker?.stripe_onboarded || !job.worker?.stripe_account_id) {
      return res.status(400).json({ error: 'Worker has not set up payments yet' });
    }

    // Create payment intent
    const amountInCents = job.total_price * 100;
    const result = await stripe.createPaymentIntent(
      amountInCents,
      job.worker.stripe_account_id,
      `HandsOn ${job.trade} job - ${job.id}`,
      { job_id: job.id, customer_id: req.user.id, worker_id: job.worker_id }
    );

    if (!result.success) {
      return res.status(500).json({ error: result.error || 'Payment setup failed' });
    }

    // Create payment record
    const paymentId = `pay-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    await supabase
      .from('payments')
      .insert({
        id: paymentId,
        job_id: job.id,
        customer_id: req.user.id,
        worker_id: job.worker_id,
        amount: amountInCents,
        platform_fee: result.platformFee,
        worker_payout: result.workerPayout,
        stripe_payment_intent_id: result.paymentIntentId,
        status: 'pending'
      });

    // Update job with payment ID
    await supabase
      .from('handson_jobs')
      .update({ payment_id: paymentId })
      .eq('id', job.id);

    res.json({
      success: true,
      clientSecret: result.clientSecret,
      paymentId,
      amount: job.total_price,
      platformFee: result.platformFee / 100,
      workerPayout: result.workerPayout / 100
    });

  } catch (error) {
    console.error('Create intent error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/payments/confirm
 * Confirm payment completed (called after Stripe success)
 */
router.post('/confirm', requireCustomer, async (req, res) => {
  try {
    const { payment_id, payment_intent_id } = req.body;

    // Verify payment with Stripe
    const stripeResult = await stripe.getPaymentIntent(payment_intent_id);

    if (!stripeResult.success || stripeResult.status !== 'succeeded') {
      return res.status(400).json({ error: 'Payment not confirmed' });
    }

    // Update payment status
    const { data: payment, error: payError } = await supabase
      .from('payments')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', payment_id)
      .eq('customer_id', req.user.id)
      .select()
      .single();

    if (payError || !payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    // Update job status to paid
    const { data: job } = await supabase
      .from('handson_jobs')
      .update({ status: 'paid', updated_at: new Date().toISOString() })
      .eq('id', payment.job_id)
      .select('*, worker:handson_workers(phone, name, total_earnings)')
      .single();

    // Update worker earnings
    if (job?.worker) {
      await supabase
        .from('handson_workers')
        .update({
          total_earnings: (job.worker.total_earnings || 0) + payment.worker_payout,
          jobs: (job.worker.jobs || 0) + 1
        })
        .eq('id', payment.worker_id);

      // Notify worker
      if (job.worker.phone) {
        await sendJobNotification(
          job.worker.phone,
          `Payment received! $${(payment.worker_payout / 100).toFixed(2)} for ${job.trade} job has been sent to your account.`
        );
      }
    }

    // Update customer spend
    await supabase
      .from('handson_customers')
      .update({
        total_spend: (req.user.total_spend || 0) + payment.amount,
        total_jobs: (req.user.total_jobs || 0) + 1
      })
      .eq('id', req.user.id);

    broadcast('JOB_PAID', job);

    res.json({ success: true, payment, job });

  } catch (error) {
    console.error('Confirm payment error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /api/payments/:id
 * Get payment details
 */
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: payment, error } = await supabase
      .from('payments')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    // Verify access
    if (payment.customer_id !== req.user.id && payment.worker_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ success: true, payment });

  } catch (error) {
    console.error('Get payment error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/payments/stripe-onboard
 * Start Stripe Connect onboarding for worker
 */
router.post('/stripe-onboard', requireWorker, async (req, res) => {
  try {
    // Check if worker already has account
    if (req.user.stripe_account_id) {
      // Generate new onboarding link
      const linkResult = await stripe.createOnboardingLink(
        req.user.stripe_account_id,
        req.user.id
      );

      if (!linkResult.success) {
        return res.status(500).json({ error: linkResult.error });
      }

      return res.json({ success: true, url: linkResult.url });
    }

    // Create new Connect account
    const accountResult = await stripe.createConnectAccount(
      req.user.id,
      req.user.email || `${req.user.phone}@handsonleads.com`
    );

    if (!accountResult.success) {
      return res.status(500).json({ error: accountResult.error });
    }

    // Save account ID
    await supabase
      .from('handson_workers')
      .update({ stripe_account_id: accountResult.accountId })
      .eq('id', req.user.id);

    // Generate onboarding link
    const linkResult = await stripe.createOnboardingLink(
      accountResult.accountId,
      req.user.id
    );

    if (!linkResult.success) {
      return res.status(500).json({ error: linkResult.error });
    }

    res.json({ success: true, url: linkResult.url });

  } catch (error) {
    console.error('Stripe onboard error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /api/payments/earnings
 * Get worker earnings summary
 */
router.get('/worker/earnings', requireWorker, async (req, res) => {
  try {
    // Get all completed payments
    const { data: payments } = await supabase
      .from('payments')
      .select('*')
      .eq('worker_id', req.user.id)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false });

    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisWeek = new Date(now);
    thisWeek.setDate(now.getDate() - now.getDay());

    const stats = {
      total: 0,
      thisMonth: 0,
      thisWeek: 0,
      pendingPayout: 0,
      jobsCompleted: payments?.length || 0,
      recentPayments: []
    };

    if (payments) {
      for (const p of payments) {
        const payout = p.worker_payout / 100;
        stats.total += payout;

        const completedDate = new Date(p.completed_at);
        if (completedDate >= thisMonth) stats.thisMonth += payout;
        if (completedDate >= thisWeek) stats.thisWeek += payout;
      }

      stats.recentPayments = payments.slice(0, 10).map(p => ({
        id: p.id,
        amount: p.worker_payout / 100,
        date: p.completed_at,
        jobId: p.job_id
      }));
    }

    // Check Stripe account status
    let stripeStatus = { onboarded: false };
    if (req.user.stripe_account_id) {
      stripeStatus = await stripe.checkAccountStatus(req.user.stripe_account_id);
    }

    res.json({
      success: true,
      earnings: stats,
      stripe: stripeStatus
    });

  } catch (error) {
    console.error('Get earnings error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /api/payments/dashboard-link
 * Get Stripe dashboard link for worker
 */
router.get('/stripe-dashboard', requireWorker, async (req, res) => {
  try {
    if (!req.user.stripe_account_id) {
      return res.status(400).json({ error: 'No Stripe account' });
    }

    const result = await stripe.createDashboardLink(req.user.stripe_account_id);

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({ success: true, url: result.url });

  } catch (error) {
    console.error('Dashboard link error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/webhooks/stripe
 * Handle Stripe webhooks
 */
router.post('/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];

  // In production, verify webhook signature
  // const event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);

  try {
    const event = JSON.parse(req.body.toString());

    switch (event.type) {
      case 'payment_intent.succeeded':
        console.log('Payment succeeded:', event.data.object.id);
        break;

      case 'account.updated':
        // Worker completed onboarding
        const account = event.data.object;
        if (account.details_submitted) {
          await supabase
            .from('handson_workers')
            .update({ stripe_onboarded: true })
            .eq('stripe_account_id', account.id);
          console.log('Worker onboarded:', account.id);
        }
        break;

      default:
        console.log('Unhandled webhook:', event.type);
    }

    res.json({ received: true });

  } catch (error) {
    console.error('Webhook error:', error);
    res.status(400).json({ error: 'Webhook error' });
  }
});

module.exports = router;
module.exports.setBroadcast = setBroadcast;
