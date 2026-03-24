// ══════════════════════════════════════════════════════════════════════════════
// JOBS ROUTES - Job Management for Customers and Workers
// ══════════════════════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { requireAuth, requireCustomer, requireWorker } = require('../middleware/auth');
const { sendJobNotification, sendJobLink } = require('../services/sms');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY
);

// WebSocket broadcast function (will be injected from server.js)
let broadcast = () => {};
function setBroadcast(fn) { broadcast = fn; }

/**
 * GET /api/jobs
 * Get jobs for current user (customer or worker)
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const { status, limit = 50 } = req.query;
    const isCustomer = req.user.userType === 'customer';

    let query = supabase
      .from('handson_jobs')
      .select(`
        *,
        worker:handson_workers(id, name, phone, rating, profile_image_url, trades),
        customer:handson_customers(id, name, phone, profile_image_url)
      `)
      .eq(isCustomer ? 'customer_id' : 'worker_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: jobs, error } = await query;

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch jobs' });
    }

    res.json({ success: true, jobs });

  } catch (error) {
    console.error('Get jobs error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /api/jobs/:id
 * Get single job details
 */
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: job, error } = await supabase
      .from('handson_jobs')
      .select(`
        *,
        worker:handson_workers(id, name, phone, email, rating, profile_image_url, trades, bio, jobs, stripe_onboarded),
        customer:handson_customers(id, name, phone, email, profile_image_url, avg_rating),
        payment:payments(*)
      `)
      .eq('id', id)
      .single();

    if (error || !job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Verify user has access to this job
    const isCustomer = req.user.userType === 'customer';
    if ((isCustomer && job.customer_id !== req.user.id) &&
        (!isCustomer && job.worker_id !== req.user.id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ success: true, job });

  } catch (error) {
    console.error('Get job error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/jobs
 * Create new job request (customer)
 */
router.post('/', requireAuth, async (req, res) => {
  try {
    const {
      trade,
      scope_of_work,
      scope_images,
      address,
      city,
      urgency = 'flexible',
      total_price,
      notes,
      // For worker-created jobs (scraper conversion)
      customer_phone,
      customer_name
    } = req.body;

    if (!trade || !scope_of_work) {
      return res.status(400).json({ error: 'Trade and scope of work required' });
    }

    const jobId = `job-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const isWorkerCreated = req.user.userType === 'worker' && customer_phone;

    let customerId = req.user.userType === 'customer' ? req.user.id : null;

    // If worker is creating job for a new customer
    if (isWorkerCreated) {
      // Check if customer exists
      const normalizedPhone = customer_phone.replace(/\D/g, '');
      let { data: existingCustomer } = await supabase
        .from('handson_customers')
        .select('id')
        .eq('phone', normalizedPhone)
        .single();

      if (!existingCustomer) {
        // Create new customer
        customerId = `c-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        await supabase
          .from('handson_customers')
          .insert({
            id: customerId,
            phone: normalizedPhone,
            name: customer_name || 'New Customer',
            status: 'pending',
            total_jobs: 0,
            total_spend: 0
          });
      } else {
        customerId = existingCustomer.id;
      }
    }

    const job = {
      id: jobId,
      customer_id: customerId,
      worker_id: isWorkerCreated ? req.user.id : null,
      trade,
      scope_of_work,
      scope_images: scope_images || [],
      address,
      city: city || 'Denver',
      urgency,
      total_price: total_price || null,
      notes,
      status: isWorkerCreated ? 'pending' : 'pending', // pending = awaiting worker
      created_at: new Date().toISOString()
    };

    const { data: newJob, error } = await supabase
      .from('handson_jobs')
      .insert(job)
      .select()
      .single();

    if (error) {
      console.error('Create job error:', error);
      return res.status(500).json({ error: 'Failed to create job' });
    }

    // If worker created job, send SMS to customer
    if (isWorkerCreated && customer_phone) {
      await sendJobLink(customer_phone, jobId, req.user.name);
    }

    // Broadcast new job
    broadcast('NEW_JOB', newJob);

    res.json({ success: true, job: newJob });

  } catch (error) {
    console.error('Create job error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/jobs/:id/accept
 * Worker accepts job
 */
router.post('/:id/accept', requireWorker, async (req, res) => {
  try {
    const { id } = req.params;
    const { quoted_price } = req.body;

    const { data: job, error: fetchError } = await supabase
      .from('handson_jobs')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.status !== 'pending') {
      return res.status(400).json({ error: 'Job is not available' });
    }

    const updates = {
      worker_id: req.user.id,
      status: 'accepted',
      accepted_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (quoted_price) {
      updates.total_price = quoted_price;
    }

    const { data: updated, error } = await supabase
      .from('handson_jobs')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to accept job' });
    }

    // Notify customer
    if (job.customer_id) {
      const { data: customer } = await supabase
        .from('handson_customers')
        .select('phone')
        .eq('id', job.customer_id)
        .single();

      if (customer?.phone) {
        await sendJobNotification(
          customer.phone,
          `Great news! ${req.user.name} has accepted your ${job.trade} job. They'll be in touch soon. View details: https://www.handsonleads.com/customer/job.html?id=${id}`
        );
      }
    }

    broadcast('JOB_ACCEPTED', updated);

    res.json({ success: true, job: updated });

  } catch (error) {
    console.error('Accept job error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/jobs/:id/decline
 * Worker declines job
 */
router.post('/:id/decline', requireWorker, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: job, error: fetchError } = await supabase
      .from('handson_jobs')
      .select('*')
      .eq('id', id)
      .eq('worker_id', req.user.id)
      .single();

    if (fetchError || !job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Reset job to pending (available for other workers)
    const { data: updated, error } = await supabase
      .from('handson_jobs')
      .update({
        worker_id: null,
        status: 'pending',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to decline job' });
    }

    broadcast('JOB_DECLINED', updated);

    res.json({ success: true, job: updated });

  } catch (error) {
    console.error('Decline job error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/jobs/:id/start
 * Worker starts job (marks in progress)
 */
router.post('/:id/start', requireWorker, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: job, error: fetchError } = await supabase
      .from('handson_jobs')
      .select('*')
      .eq('id', id)
      .eq('worker_id', req.user.id)
      .single();

    if (fetchError || !job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.status !== 'accepted') {
      return res.status(400).json({ error: 'Job must be accepted first' });
    }

    const { data: updated, error } = await supabase
      .from('handson_jobs')
      .update({
        status: 'in_progress',
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to start job' });
    }

    broadcast('JOB_STARTED', updated);

    res.json({ success: true, job: updated });

  } catch (error) {
    console.error('Start job error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/jobs/:id/complete
 * Worker completes job (submits proof of work)
 */
router.post('/:id/complete', requireWorker, async (req, res) => {
  try {
    const { id } = req.params;
    const { proof_of_work_images, final_price, notes } = req.body;

    const { data: job, error: fetchError } = await supabase
      .from('handson_jobs')
      .select('*, customer:handson_customers(phone)')
      .eq('id', id)
      .eq('worker_id', req.user.id)
      .single();

    if (fetchError || !job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.status !== 'in_progress') {
      return res.status(400).json({ error: 'Job must be in progress' });
    }

    const updates = {
      status: 'completed',
      completed_date: new Date().toISOString().split('T')[0],
      updated_at: new Date().toISOString()
    };

    if (proof_of_work_images) {
      updates.proof_of_work_images = proof_of_work_images;
    }

    if (final_price) {
      updates.total_price = final_price;
    }

    if (notes) {
      updates.notes = (job.notes || '') + '\n\nWorker notes: ' + notes;
    }

    const { data: updated, error } = await supabase
      .from('handson_jobs')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to complete job' });
    }

    // Notify customer
    if (job.customer?.phone) {
      await sendJobNotification(
        job.customer.phone,
        `Your ${job.trade} job is complete! Review the work and pay ${req.user.name}: https://www.handsonleads.com/customer/job.html?id=${id}`
      );
    }

    broadcast('JOB_COMPLETED', updated);

    res.json({ success: true, job: updated });

  } catch (error) {
    console.error('Complete job error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/jobs/:id/review
 * Submit review for job (customer or worker)
 */
router.post('/:id/review', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be 1-5' });
    }

    const { data: job, error: fetchError } = await supabase
      .from('handson_jobs')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Verify user is part of this job
    const isCustomer = req.user.userType === 'customer';
    if ((isCustomer && job.customer_id !== req.user.id) ||
        (!isCustomer && job.worker_id !== req.user.id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check job is completed or paid
    if (!['completed', 'paid'].includes(job.status)) {
      return res.status(400).json({ error: 'Can only review completed jobs' });
    }

    // Determine who is being reviewed
    const revieweeType = isCustomer ? 'worker' : 'customer';
    const revieweeId = isCustomer ? job.worker_id : job.customer_id;

    // Check for existing review
    const { data: existingReview } = await supabase
      .from('reviews')
      .select('id')
      .eq('job_id', id)
      .eq('reviewer_id', req.user.id)
      .single();

    if (existingReview) {
      return res.status(400).json({ error: 'Already reviewed this job' });
    }

    // Create review
    const reviewId = `rev-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const { data: review, error: reviewError } = await supabase
      .from('reviews')
      .insert({
        id: reviewId,
        job_id: id,
        reviewer_type: req.user.userType,
        reviewer_id: req.user.id,
        reviewee_type: revieweeType,
        reviewee_id: revieweeId,
        rating,
        comment
      })
      .select()
      .single();

    if (reviewError) {
      return res.status(500).json({ error: 'Failed to create review' });
    }

    // Update job with rating
    const ratingField = isCustomer ? 'worker_rating' : 'customer_rating';
    await supabase
      .from('handson_jobs')
      .update({ [ratingField]: rating })
      .eq('id', id);

    // Update reviewee's average rating
    const revieweeTable = revieweeType === 'customer' ? 'handson_customers' : 'handson_workers';
    const { data: allReviews } = await supabase
      .from('reviews')
      .select('rating')
      .eq('reviewee_id', revieweeId)
      .eq('reviewee_type', revieweeType);

    if (allReviews && allReviews.length > 0) {
      const avgRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
      await supabase
        .from(revieweeTable)
        .update({
          avg_rating: Math.round(avgRating * 10) / 10,
          review_count: allReviews.length
        })
        .eq('id', revieweeId);
    }

    res.json({ success: true, review });

  } catch (error) {
    console.error('Review error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
module.exports.setBroadcast = setBroadcast;
