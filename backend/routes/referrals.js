// ══════════════════════════════════════════════════════════════════════════════
// REFERRALS ROUTES - Affiliate/Referral System with Proof of Work & Payment
// ══════════════════════════════════════════════════════════════════════════════
//
// STATUS FLOW:
//   PENDING → JOB_LINKED → WORK_VERIFIED → PAYMENT_CONFIRMED → PAID
//
// Referral payout only happens after:
//   1. Job is linked to the referral
//   2. Proof of work submitted (photo)
//   3. Customer payment confirmed
// ══════════════════════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { requireAuth } = require('../middleware/auth');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY
);

// Valid status transitions
const VALID_STATUSES = ['PENDING', 'JOB_LINKED', 'WORK_VERIFIED', 'PAYMENT_CONFIRMED', 'PAID', 'CANCELLED'];

/**
 * GET /api/referrals
 * Get all referrals for the authenticated user
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const { data: referrals, error } = await supabase
      .from('handson_referrals')
      .select('*')
      .eq('referrer_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching referrals:', error);
      return res.status(500).json({ error: 'Failed to fetch referrals' });
    }

    res.json({ referrals: referrals || [] });

  } catch (error) {
    console.error('Get referrals error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /api/referrals/stats
 * Get referral earnings statistics
 */
router.get('/stats', requireAuth, async (req, res) => {
  try {
    const { data: referrals, error } = await supabase
      .from('handson_referrals')
      .select('*')
      .eq('referrer_id', req.user.id);

    if (error) {
      console.error('Error fetching referral stats:', error);
      return res.status(500).json({ error: 'Failed to fetch stats' });
    }

    const all = referrals || [];
    const stats = {
      total: all.length,
      pending: all.filter(r => r.status === 'PENDING').length,
      jobLinked: all.filter(r => r.status === 'JOB_LINKED').length,
      workVerified: all.filter(r => r.status === 'WORK_VERIFIED').length,
      paymentConfirmed: all.filter(r => r.status === 'PAYMENT_CONFIRMED').length,
      paid: all.filter(r => r.status === 'PAID').length,
      cancelled: all.filter(r => r.status === 'CANCELLED').length,
      totalEarned: all.filter(r => r.status === 'PAID').reduce((sum, r) => sum + (r.payout || 0), 0),
      pendingPayout: all.filter(r => r.status === 'PAYMENT_CONFIRMED').reduce((sum, r) => sum + (r.payout || 0), 0),
      // Breakdown by verification stage
      awaitingJob: all.filter(r => r.status === 'PENDING').length,
      awaitingProof: all.filter(r => r.status === 'JOB_LINKED').length,
      awaitingPayment: all.filter(r => r.status === 'WORK_VERIFIED').length,
      readyForPayout: all.filter(r => r.status === 'PAYMENT_CONFIRMED').length
    };

    res.json({ stats });

  } catch (error) {
    console.error('Get referral stats error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /api/referrals/:id
 * Get single referral with full details
 */
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: referral, error } = await supabase
      .from('handson_referrals')
      .select('*')
      .eq('id', id)
      .eq('referrer_id', req.user.id)
      .single();

    if (error || !referral) {
      return res.status(404).json({ error: 'Referral not found' });
    }

    // If job is linked, fetch job details
    let job = null;
    if (referral.job_id) {
      const { data: jobData } = await supabase
        .from('handson_jobs')
        .select('*')
        .eq('id', referral.job_id)
        .single();
      job = jobData;
    }

    res.json({ referral, job });

  } catch (error) {
    console.error('Get referral error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /api/referrals/code
 * Get or generate user's referral code
 */
router.get('/code', requireAuth, async (req, res) => {
  try {
    // Check if user already has a code
    let { data: existing } = await supabase
      .from('referral_codes')
      .select('*')
      .eq('user_id', req.user.id)
      .single();

    if (existing) {
      return res.json({ code: existing.code, uses: existing.uses });
    }

    // Generate new code
    const code = req.user.name
      ? req.user.name.replace(/\s/g, '').toUpperCase().slice(0, 6) + Math.random().toString(36).slice(2, 4).toUpperCase()
      : 'REF' + req.user.id.slice(0, 8).toUpperCase();

    const { data: newCode, error } = await supabase
      .from('referral_codes')
      .insert({
        id: `code-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        user_id: req.user.id,
        user_type: req.user.type || 'worker',
        code: code
      })
      .select()
      .single();

    if (error) {
      // If code already exists, just return a simple code
      const simpleCode = req.user.id.slice(0, 8).toUpperCase();
      return res.json({ code: simpleCode, uses: 0 });
    }

    res.json({ code: newCode.code, uses: 0 });

  } catch (error) {
    console.error('Get referral code error:', error);
    // Return fallback code
    res.json({ code: req.user.id.slice(0, 8).toUpperCase(), uses: 0 });
  }
});

/**
 * POST /api/referrals
 * Submit a new referral (customer or worker)
 */
router.post('/', requireAuth, async (req, res) => {
  try {
    const {
      customer_name,
      customer_phone,
      trade,
      notes,
      referral_type = 'customer'
    } = req.body;

    if (!customer_name || !customer_phone) {
      return res.status(400).json({ error: 'Name and phone required' });
    }

    // Normalize phone
    const phone = customer_phone.replace(/\D/g, '');

    // Check for duplicate
    const { data: existing } = await supabase
      .from('handson_referrals')
      .select('id')
      .eq('customer_phone', phone)
      .eq('referrer_id', req.user.id)
      .single();

    if (existing) {
      return res.status(400).json({ error: 'You already referred this person' });
    }

    // Determine payout based on type
    const payout = referral_type === 'worker' ? 0 : 25; // Worker referrals have ongoing commission, not flat fee

    // Create referral with new verification fields
    const { data: referral, error } = await supabase
      .from('handson_referrals')
      .insert({
        id: `ref-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        referrer_id: req.user.id,
        referrer_type: req.user.type || 'worker',
        customer_name,
        customer_phone: phone,
        trade: trade || null,
        notes: notes || null,
        referral_type: referral_type,
        status: 'PENDING',
        payout,
        date: new Date().toISOString().split('T')[0],
        // Verification fields (null until verified)
        job_id: null,
        job_completed_at: null,
        proof_photo_url: null,
        payment_received_at: null,
        payment_amount: null,
        payment_method: null,
        verified_by: null,
        paid_at: null
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating referral:', error);
      return res.status(500).json({ error: 'Failed to create referral' });
    }

    console.log(`📣 New referral submitted: ${customer_name} by ${req.user.name}`);
    res.status(201).json({ referral });

  } catch (error) {
    console.error('Create referral error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * PUT /api/referrals/:id/link-job
 * Link a referral to an actual job (Step 1)
 */
router.put('/:id/link-job', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { job_id } = req.body;

    if (!job_id) {
      return res.status(400).json({ error: 'Job ID required' });
    }

    // Verify the referral exists and belongs to this user
    const { data: referral, error: fetchError } = await supabase
      .from('handson_referrals')
      .select('*')
      .eq('id', id)
      .eq('referrer_id', req.user.id)
      .single();

    if (fetchError || !referral) {
      return res.status(404).json({ error: 'Referral not found' });
    }

    if (referral.status !== 'PENDING') {
      return res.status(400).json({ error: 'Can only link job to pending referrals' });
    }

    // Verify the job exists (check both jobs and leads tables)
    let job = null;

    // First check handson_jobs
    const { data: jobData } = await supabase
      .from('handson_jobs')
      .select('id, customer_name, status')
      .eq('id', job_id)
      .single();

    if (jobData) {
      job = jobData;
    } else {
      // Fall back to handson_leads (claimed leads become jobs)
      const { data: leadData } = await supabase
        .from('handson_leads')
        .select('id, title, status, claimed_by')
        .eq('id', job_id)
        .single();

      if (leadData) {
        job = { id: leadData.id, customer_name: leadData.title, status: leadData.status };
      }
    }

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Update referral with job link (store in notes as JSON until schema updated)
    let existingData = {};
    try {
      existingData = JSON.parse(referral.notes || '{}');
    } catch(e) {
      // Notes is plain text, wrap it
      existingData = { original_notes: referral.notes };
    }

    existingData.verification = {
      job_id: job_id,
      job_linked_at: new Date().toISOString()
    };

    const { data: updated, error } = await supabase
      .from('handson_referrals')
      .update({
        status: 'JOB_LINKED',
        notes: JSON.stringify(existingData)
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error linking job:', error);
      return res.status(500).json({ error: 'Failed to link job' });
    }

    console.log(`🔗 Referral ${id} linked to job ${job_id}`);
    res.json({ referral: { ...updated, job_id }, job });

  } catch (error) {
    console.error('Link job error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * PUT /api/referrals/:id/verify-work
 * Submit proof of work - photo of completed job (Step 2)
 */
router.put('/:id/verify-work', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { proof_photo_url, job_completed_at } = req.body;

    if (!proof_photo_url) {
      return res.status(400).json({ error: 'Proof photo URL required' });
    }

    // Verify the referral exists
    const { data: referral, error: fetchError } = await supabase
      .from('handson_referrals')
      .select('*')
      .eq('id', id)
      .eq('referrer_id', req.user.id)
      .single();

    if (fetchError || !referral) {
      return res.status(404).json({ error: 'Referral not found' });
    }

    if (referral.status !== 'JOB_LINKED') {
      return res.status(400).json({
        error: 'Must link job first before submitting proof of work',
        currentStatus: referral.status
      });
    }

    // Update with proof of work (store in notes as JSON until schema updated)
    let existingData = {};
    try {
      existingData = JSON.parse(referral.notes || '{}');
    } catch(e) {
      existingData = { original_notes: referral.notes };
    }

    existingData.verification = {
      ...existingData.verification,
      proof_photo_url: proof_photo_url,
      job_completed_at: job_completed_at || new Date().toISOString()
    };

    const { data: updated, error } = await supabase
      .from('handson_referrals')
      .update({
        status: 'WORK_VERIFIED',
        notes: JSON.stringify(existingData)
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error verifying work:', error);
      return res.status(500).json({ error: 'Failed to verify work' });
    }

    console.log(`📸 Proof of work submitted for referral ${id}`);
    res.json({ referral: { ...updated, proof_photo_url } });

  } catch (error) {
    console.error('Verify work error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * PUT /api/referrals/:id/verify-payment
 * Confirm customer payment received (Step 3)
 */
router.put('/:id/verify-payment', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { payment_amount, payment_method, payment_received_at } = req.body;

    if (!payment_amount || !payment_method) {
      return res.status(400).json({ error: 'Payment amount and method required' });
    }

    if (!['stripe', 'cash', 'check', 'venmo', 'zelle', 'other'].includes(payment_method.toLowerCase())) {
      return res.status(400).json({ error: 'Invalid payment method' });
    }

    // Verify the referral exists
    const { data: referral, error: fetchError } = await supabase
      .from('handson_referrals')
      .select('*')
      .eq('id', id)
      .eq('referrer_id', req.user.id)
      .single();

    if (fetchError || !referral) {
      return res.status(404).json({ error: 'Referral not found' });
    }

    if (referral.status !== 'WORK_VERIFIED') {
      return res.status(400).json({
        error: 'Must submit proof of work first before confirming payment',
        currentStatus: referral.status
      });
    }

    // Update with payment confirmation (store in notes as JSON until schema updated)
    let existingData = {};
    try {
      existingData = JSON.parse(referral.notes || '{}');
    } catch(e) {
      existingData = { original_notes: referral.notes };
    }

    existingData.verification = {
      ...existingData.verification,
      payment_amount: parseFloat(payment_amount),
      payment_method: payment_method.toLowerCase(),
      payment_received_at: payment_received_at || new Date().toISOString()
    };

    const { data: updated, error } = await supabase
      .from('handson_referrals')
      .update({
        status: 'PAYMENT_CONFIRMED',
        notes: JSON.stringify(existingData)
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error verifying payment:', error);
      return res.status(500).json({ error: 'Failed to verify payment' });
    }

    console.log(`💰 Payment confirmed for referral ${id}: $${payment_amount} via ${payment_method}`);
    res.json({
      referral: { ...updated, payment_amount: parseFloat(payment_amount), payment_method: payment_method.toLowerCase() },
      message: 'Payment confirmed! Referral is now eligible for payout.',
      payoutAmount: updated.payout
    });

  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * PUT /api/referrals/:id/payout
 * Mark referral as paid out (Final Step - typically admin only)
 */
router.put('/:id/payout', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { verified_by } = req.body;

    // Verify the referral exists
    const { data: referral, error: fetchError } = await supabase
      .from('handson_referrals')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !referral) {
      return res.status(404).json({ error: 'Referral not found' });
    }

    if (referral.status !== 'PAYMENT_CONFIRMED') {
      return res.status(400).json({
        error: 'Referral must have confirmed payment before payout',
        currentStatus: referral.status
      });
    }

    // Mark as paid (store in notes as JSON until schema updated)
    let existingData = {};
    try {
      existingData = JSON.parse(referral.notes || '{}');
    } catch(e) {
      existingData = { original_notes: referral.notes };
    }

    existingData.verification = {
      ...existingData.verification,
      paid_at: new Date().toISOString(),
      verified_by: verified_by || req.user.id
    };

    const { data: updated, error } = await supabase
      .from('handson_referrals')
      .update({
        status: 'PAID',
        notes: JSON.stringify(existingData)
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error processing payout:', error);
      return res.status(500).json({ error: 'Failed to process payout' });
    }

    console.log(`✅ Referral ${id} PAID OUT: $${updated.payout} to ${referral.referrer_id}`);
    res.json({
      referral: updated,
      message: `Payout of $${updated.payout} processed successfully!`
    });

  } catch (error) {
    console.error('Payout error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * PUT /api/referrals/:id/cancel
 * Cancel a referral (only if not yet paid)
 */
router.put('/:id/cancel', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const { data: referral, error: fetchError } = await supabase
      .from('handson_referrals')
      .select('*')
      .eq('id', id)
      .eq('referrer_id', req.user.id)
      .single();

    if (fetchError || !referral) {
      return res.status(404).json({ error: 'Referral not found' });
    }

    if (referral.status === 'PAID') {
      return res.status(400).json({ error: 'Cannot cancel a paid referral' });
    }

    const { data: updated, error } = await supabase
      .from('handson_referrals')
      .update({
        status: 'CANCELLED',
        notes: referral.notes ? `${referral.notes}\n\nCANCELLED: ${reason || 'No reason provided'}` : `CANCELLED: ${reason || 'No reason provided'}`,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error cancelling referral:', error);
      return res.status(500).json({ error: 'Failed to cancel referral' });
    }

    res.json({ referral: updated });

  } catch (error) {
    console.error('Cancel referral error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * DELETE /api/referrals/:id
 * Delete a pending referral
 */
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // Only allow deleting pending referrals
    const { data: referral, error: fetchError } = await supabase
      .from('handson_referrals')
      .select('status')
      .eq('id', id)
      .eq('referrer_id', req.user.id)
      .single();

    if (fetchError || !referral) {
      return res.status(404).json({ error: 'Referral not found' });
    }

    if (referral.status !== 'PENDING') {
      return res.status(400).json({ error: 'Can only delete pending referrals' });
    }

    const { error } = await supabase
      .from('handson_referrals')
      .delete()
      .eq('id', id)
      .eq('referrer_id', req.user.id);

    if (error) {
      console.error('Error deleting referral:', error);
      return res.status(500).json({ error: 'Failed to delete referral' });
    }

    res.json({ success: true });

  } catch (error) {
    console.error('Delete referral error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
