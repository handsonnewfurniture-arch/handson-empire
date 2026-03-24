// ══════════════════════════════════════════════════════════════════════════════
// PORTFOLIO ROUTES - Instagram-style Work Gallery
// ══════════════════════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { uploadPortfolioImage, deleteFile, BUCKETS } = require('../services/storage');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY
);

// Multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images allowed'), false);
    }
  }
});

/**
 * GET /api/portfolio/feed
 * Public portfolio feed (Instagram-style)
 */
router.get('/feed', async (req, res) => {
  try {
    const { trade, city, limit = 30, offset = 0 } = req.query;

    let query = supabase
      .from('portfolio_items')
      .select(`
        *,
        worker:handson_workers(id, name, rating, profile_image_url, trades)
      `)
      .eq('user_type', 'worker')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (trade) {
      query = query.eq('trade', trade);
    }

    if (city) {
      query = query.ilike('city', `%${city}%`);
    }

    const { data: items, error } = await query;

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch portfolio' });
    }

    res.json({ success: true, items });

  } catch (error) {
    console.error('Portfolio feed error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /api/portfolio/featured
 * Get featured portfolio items
 */
router.get('/featured', async (req, res) => {
  try {
    const { limit = 12 } = req.query;

    const { data: items, error } = await supabase
      .from('portfolio_items')
      .select(`
        *,
        worker:handson_workers(id, name, rating, profile_image_url)
      `)
      .eq('user_type', 'worker')
      .eq('is_featured', true)
      .order('likes', { ascending: false })
      .limit(limit);

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch featured' });
    }

    res.json({ success: true, items });

  } catch (error) {
    console.error('Featured error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /api/portfolio/:userType/:userId
 * Get user's portfolio
 */
router.get('/:userType/:userId', async (req, res) => {
  try {
    const { userType, userId } = req.params;
    const { limit = 50 } = req.query;

    if (!['customer', 'worker'].includes(userType)) {
      return res.status(400).json({ error: 'Invalid user type' });
    }

    const { data: items, error } = await supabase
      .from('portfolio_items')
      .select('*')
      .eq('user_type', userType)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch portfolio' });
    }

    // Get user info
    const table = userType === 'customer' ? 'handson_customers' : 'handson_workers';
    const { data: user } = await supabase
      .from(table)
      .select('id, name, profile_image_url, rating, avg_rating, jobs, review_count, bio, trades')
      .eq('id', userId)
      .single();

    res.json({ success: true, items, user });

  } catch (error) {
    console.error('Get portfolio error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/portfolio/upload
 * Upload new portfolio item
 */
router.post('/upload', requireAuth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Image required' });
    }

    const { caption, trade, city, job_id } = req.body;

    // Upload to storage
    const uploadResult = await uploadPortfolioImage(
      req.file.buffer,
      req.user.id,
      req.file.originalname
    );

    if (!uploadResult.success) {
      return res.status(500).json({ error: 'Upload failed' });
    }

    // Create portfolio item
    const itemId = `port-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const { data: item, error } = await supabase
      .from('portfolio_items')
      .insert({
        id: itemId,
        user_type: req.user.userType,
        user_id: req.user.id,
        job_id: job_id || null,
        image_url: uploadResult.url,
        caption: caption || '',
        trade: trade || (req.user.trades ? req.user.trades[0] : null),
        city: city || req.user.city || 'Denver'
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to save item' });
    }

    res.json({ success: true, item });

  } catch (error) {
    console.error('Upload portfolio error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/portfolio/from-job/:jobId
 * Add portfolio item from completed job
 */
router.post('/from-job/:jobId', requireAuth, async (req, res) => {
  try {
    const { jobId } = req.params;
    const { caption, image_index = 0 } = req.body;

    // Get job with proof of work
    const { data: job, error: jobError } = await supabase
      .from('handson_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Verify ownership
    if (job.worker_id !== req.user.id && job.customer_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get image from proof of work
    const images = job.proof_of_work_images || [];
    if (images.length === 0) {
      return res.status(400).json({ error: 'No images in this job' });
    }

    const imageUrl = images[image_index] || images[0];

    // Create portfolio item
    const itemId = `port-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const { data: item, error } = await supabase
      .from('portfolio_items')
      .insert({
        id: itemId,
        user_type: req.user.userType,
        user_id: req.user.id,
        job_id: jobId,
        image_url: imageUrl,
        caption: caption || `${job.trade} job completed`,
        trade: job.trade,
        city: job.city || 'Denver'
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to save item' });
    }

    res.json({ success: true, item });

  } catch (error) {
    console.error('Portfolio from job error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * PUT /api/portfolio/:id
 * Update portfolio item
 */
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { caption, is_featured } = req.body;

    const { data: item, error: fetchError } = await supabase
      .from('portfolio_items')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();

    if (fetchError || !item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const updates = {};
    if (caption !== undefined) updates.caption = caption;
    if (is_featured !== undefined) updates.is_featured = is_featured;

    const { data: updated, error } = await supabase
      .from('portfolio_items')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to update' });
    }

    res.json({ success: true, item: updated });

  } catch (error) {
    console.error('Update portfolio error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * DELETE /api/portfolio/:id
 * Delete portfolio item
 */
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: item, error: fetchError } = await supabase
      .from('portfolio_items')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();

    if (fetchError || !item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Delete from database
    const { error } = await supabase
      .from('portfolio_items')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(500).json({ error: 'Failed to delete' });
    }

    res.json({ success: true });

  } catch (error) {
    console.error('Delete portfolio error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/portfolio/:id/like
 * Like a portfolio item
 */
router.post('/:id/like', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: item, error } = await supabase
      .from('portfolio_items')
      .update({ likes: supabase.raw('likes + 1') })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      // Fallback: fetch and increment manually
      const { data: current } = await supabase
        .from('portfolio_items')
        .select('likes')
        .eq('id', id)
        .single();

      if (current) {
        await supabase
          .from('portfolio_items')
          .update({ likes: (current.likes || 0) + 1 })
          .eq('id', id);
      }
    }

    res.json({ success: true });

  } catch (error) {
    console.error('Like error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
