// ══════════════════════════════════════════════════════════════════════════════
// AUTH MIDDLEWARE - Session Token Verification
// ══════════════════════════════════════════════════════════════════════════════

const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY
);

const JWT_SECRET = process.env.JWT_SECRET || 'handson-secret-key-change-in-production';

/**
 * Generate JWT token for authenticated user
 */
function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      phone: user.phone,
      userType: user.userType,
      name: user.name
    },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

/**
 * Verify JWT token
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

/**
 * Auth middleware - requires valid token
 * Attaches user to req.user
 */
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);

  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Fetch fresh user data
  const table = decoded.userType === 'customer' ? 'handson_customers' : 'handson_workers';
  const { data: user, error } = await supabase
    .from(table)
    .select('*')
    .eq('id', decoded.id)
    .single();

  if (error || !user) {
    return res.status(401).json({ error: 'User not found' });
  }

  req.user = {
    ...user,
    userType: decoded.userType
  };

  next();
}

/**
 * Optional auth middleware - attaches user if token present, but doesn't require it
 */
async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);

  if (!decoded) {
    req.user = null;
    return next();
  }

  const table = decoded.userType === 'customer' ? 'handson_customers' : 'handson_workers';
  const { data: user } = await supabase
    .from(table)
    .select('*')
    .eq('id', decoded.id)
    .single();

  req.user = user ? { ...user, userType: decoded.userType } : null;
  next();
}

/**
 * Require customer auth
 */
async function requireCustomer(req, res, next) {
  await requireAuth(req, res, () => {
    if (req.user.userType !== 'customer') {
      return res.status(403).json({ error: 'Customer access required' });
    }
    next();
  });
}

/**
 * Require worker auth
 */
async function requireWorker(req, res, next) {
  await requireAuth(req, res, () => {
    if (req.user.userType !== 'worker') {
      return res.status(403).json({ error: 'Worker access required' });
    }
    next();
  });
}

module.exports = {
  generateToken,
  verifyToken,
  requireAuth,
  optionalAuth,
  requireCustomer,
  requireWorker,
  JWT_SECRET
};
