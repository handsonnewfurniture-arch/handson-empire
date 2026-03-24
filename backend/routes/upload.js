// ══════════════════════════════════════════════════════════════════════════════
// UPLOAD ROUTES - Image Upload Endpoints
// ══════════════════════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { requireAuth } = require('../middleware/auth');
const storage = require('../services/storage');

// Multer configuration
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images allowed'), false);
    }
  }
});

/**
 * POST /api/upload/profile
 * Upload profile image
 */
router.post('/profile', requireAuth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Image required' });
    }

    const result = await storage.uploadProfileImage(
      req.file.buffer,
      req.user.id,
      req.user.userType,
      req.file.originalname
    );

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({ success: true, url: result.url });

  } catch (error) {
    console.error('Profile upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

/**
 * POST /api/upload/scope
 * Upload scope of work images (multiple)
 */
router.post('/scope', requireAuth, upload.array('images', 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'At least one image required' });
    }

    const { job_id } = req.body;
    if (!job_id) {
      return res.status(400).json({ error: 'Job ID required' });
    }

    const urls = [];
    for (const file of req.files) {
      const result = await storage.uploadJobScopeImage(
        file.buffer,
        job_id,
        file.originalname
      );

      if (result.success) {
        urls.push(result.url);
      }
    }

    res.json({ success: true, urls });

  } catch (error) {
    console.error('Scope upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

/**
 * POST /api/upload/proof-of-work
 * Upload proof of work images (multiple)
 */
router.post('/proof-of-work', requireAuth, upload.array('images', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'At least one image required' });
    }

    const { job_id } = req.body;
    if (!job_id) {
      return res.status(400).json({ error: 'Job ID required' });
    }

    const urls = [];
    for (const file of req.files) {
      const result = await storage.uploadProofOfWork(
        file.buffer,
        job_id,
        file.originalname
      );

      if (result.success) {
        urls.push(result.url);
      }
    }

    res.json({ success: true, urls });

  } catch (error) {
    console.error('Proof upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

/**
 * POST /api/upload/proof-of-payment
 * Upload proof of payment image
 */
router.post('/proof-of-payment', requireAuth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Image required' });
    }

    const { job_id } = req.body;
    if (!job_id) {
      return res.status(400).json({ error: 'Job ID required' });
    }

    const result = await storage.uploadProofOfPayment(
      req.file.buffer,
      job_id,
      req.file.originalname
    );

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({ success: true, url: result.url });

  } catch (error) {
    console.error('Payment proof upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

module.exports = router;
