// ══════════════════════════════════════════════════════════════════════════════
// AUTH ROUTES - Phone/SMS OTP Authentication
// ══════════════════════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { generateOTP, sendOTP } = require('../services/sms');
const { generateToken, requireAuth } = require('../middleware/auth');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY
);

/**
 * POST /api/auth/send-code
 * Send verification code to phone number
 */
router.post('/send-code', async (req, res) => {
  try {
    const { phone, userType = 'customer' } = req.body;

    if (!phone) {
      return res.status(400).json({ error: 'Phone number required' });
    }

    if (!['customer', 'worker'].includes(userType)) {
      return res.status(400).json({ error: 'Invalid user type' });
    }

    // Generate OTP
    const code = generateOTP();
    const sessionId = `sess-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store session
    const { error: sessionError } = await supabase
      .from('auth_sessions')
      .insert({
        id: sessionId,
        phone: phone.replace(/\D/g, ''),
        code,
        user_type: userType,
        expires_at: expiresAt.toISOString()
      });

    if (sessionError) {
      console.error('Session error:', sessionError);
      return res.status(500).json({ error: 'Failed to create session' });
    }

    // Send SMS
    const smsResult = await sendOTP(phone, code);

    if (!smsResult.success) {
      return res.status(500).json({ error: 'Failed to send SMS' });
    }

    res.json({
      success: true,
      sessionId,
      message: 'Verification code sent',
      expiresAt: expiresAt.toISOString()
    });

  } catch (error) {
    console.error('Send code error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/auth/verify-code
 * Verify OTP and return auth token
 */
router.post('/verify-code', async (req, res) => {
  try {
    const { phone, code, sessionId, name } = req.body;

    if (!phone || !code) {
      return res.status(400).json({ error: 'Phone and code required' });
    }

    const normalizedPhone = phone.replace(/\D/g, '');

    // Find valid session
    const { data: session, error: sessionError } = await supabase
      .from('auth_sessions')
      .select('*')
      .eq('phone', normalizedPhone)
      .eq('code', code)
      .eq('verified', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (sessionError || !session) {
      return res.status(400).json({ error: 'Invalid or expired code' });
    }

    // Mark session as verified
    await supabase
      .from('auth_sessions')
      .update({ verified: true })
      .eq('id', session.id);

    // Find or create user
    const table = session.user_type === 'customer' ? 'handson_customers' : 'handson_workers';

    let { data: user } = await supabase
      .from(table)
      .select('*')
      .eq('phone', normalizedPhone)
      .single();

    let isNewUser = false;

    if (!user) {
      // Create new user
      isNewUser = true;
      const userId = `${session.user_type.charAt(0)}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

      const newUser = {
        id: userId,
        phone: normalizedPhone,
        name: name || 'New User',
        status: session.user_type === 'customer' ? 'active' : 'pending',
        created_at: new Date().toISOString()
      };

      // Add type-specific defaults
      if (session.user_type === 'customer') {
        newUser.total_jobs = 0;
        newUser.total_spend = 0;
      } else {
        newUser.trades = [];
        newUser.rating = 5.0;
        newUser.jobs = 0;
      }

      const { data: created, error: createError } = await supabase
        .from(table)
        .insert(newUser)
        .select()
        .single();

      if (createError) {
        console.error('Create user error:', createError);
        return res.status(500).json({ error: 'Failed to create user' });
      }

      user = created;
    }

    // Update session with user ID
    await supabase
      .from('auth_sessions')
      .update({ user_id: user.id })
      .eq('id', session.id);

    // Generate token
    const token = generateToken({
      id: user.id,
      phone: user.phone,
      userType: session.user_type,
      name: user.name
    });

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        userType: session.user_type,
        isNewUser
      }
    });

  } catch (error) {
    console.error('Verify code error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /api/auth/me
 * Get current authenticated user
 */
router.get('/me', requireAuth, async (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user.id,
      name: req.user.name,
      phone: req.user.phone,
      email: req.user.email,
      userType: req.user.userType,
      profileImage: req.user.profile_image_url,
      ...(req.user.userType === 'customer' ? {
        totalJobs: req.user.total_jobs,
        totalSpend: req.user.total_spend
      } : {
        trades: req.user.trades,
        rating: req.user.rating,
        jobs: req.user.jobs,
        bio: req.user.bio,
        stripeOnboarded: req.user.stripe_onboarded
      })
    }
  });
});

/**
 * POST /api/auth/dev-login
 * DEV ONLY - Quick login by phone without SMS (for testing)
 */
router.post('/dev-login', async (req, res) => {
  try {
    const { phone, userType = 'worker' } = req.body;

    if (!phone) {
      return res.status(400).json({ error: 'Phone required' });
    }

    const normalizedPhone = phone.replace(/\D/g, '');
    const table = userType === 'customer' ? 'handson_customers' : 'handson_workers';

    // Find user by phone
    const { data: user, error } = await supabase
      .from(table)
      .select('*')
      .eq('phone', normalizedPhone)
      .single();

    if (error || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate token
    const token = generateToken({
      id: user.id,
      phone: user.phone,
      userType: userType,
      name: user.name
    });

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        type: userType,
        trades: user.trades,
        rating: user.rating,
        jobs: user.jobs
      }
    });

  } catch (error) {
    console.error('Dev login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/auth/logout
 * Invalidate session (client should clear token)
 */
router.post('/logout', requireAuth, async (req, res) => {
  // In a more robust system, we'd blacklist the token
  // For now, client just clears localStorage
  res.json({ success: true, message: 'Logged out' });
});

/**
 * PUT /api/auth/profile
 * Update user profile
 */
router.put('/profile', requireAuth, async (req, res) => {
  try {
    const { name, email, bio, address, city, trades } = req.body;
    const table = req.user.userType === 'customer' ? 'handson_customers' : 'handson_workers';

    const updates = {
      updated_at: new Date().toISOString()
    };

    if (name) updates.name = name;
    if (email) updates.email = email;
    if (address) updates.address = address;
    if (city) updates.city = city;

    // Worker-specific fields
    if (req.user.userType === 'worker') {
      if (bio) updates.bio = bio;
      if (trades && Array.isArray(trades)) updates.trades = trades;
    }

    const { data: user, error } = await supabase
      .from(table)
      .update(updates)
      .eq('id', req.user.id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to update profile' });
    }

    res.json({ success: true, user });

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
