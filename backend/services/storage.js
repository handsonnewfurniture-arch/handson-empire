// ══════════════════════════════════════════════════════════════════════════════
// STORAGE SERVICE - Supabase Storage for Images
// ══════════════════════════════════════════════════════════════════════════════

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY
);

// Bucket names
const BUCKETS = {
  PROFILES: 'profile-images',
  JOBS: 'job-images',
  PORTFOLIO: 'portfolio-images',
  PAYMENTS: 'proof-of-payment'
};

/**
 * Generate unique filename
 */
function generateFilename(originalName, prefix = '') {
  const ext = originalName.split('.').pop() || 'jpg';
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}${timestamp}-${random}.${ext}`;
}

/**
 * Upload file to Supabase Storage
 * @param {string} bucket - Bucket name
 * @param {Buffer} fileBuffer - File data
 * @param {string} filename - Desired filename
 * @param {string} contentType - MIME type
 * @returns {Promise<{success: boolean, url?: string, error?: string}>}
 */
async function uploadFile(bucket, fileBuffer, filename, contentType = 'image/jpeg') {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filename, fileBuffer, {
        contentType,
        upsert: true
      });

    if (error) {
      console.error(`Storage upload error: ${error.message}`);
      return { success: false, error: error.message };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(filename);

    return { success: true, url: urlData.publicUrl, path: data.path };
  } catch (err) {
    console.error(`Storage error: ${err.message}`);
    return { success: false, error: err.message };
  }
}

/**
 * Upload profile image
 */
async function uploadProfileImage(fileBuffer, userId, userType, originalName) {
  const filename = generateFilename(originalName, `${userType}/${userId}/profile-`);
  return uploadFile(BUCKETS.PROFILES, fileBuffer, filename);
}

/**
 * Upload job scope images
 */
async function uploadJobScopeImage(fileBuffer, jobId, originalName) {
  const filename = generateFilename(originalName, `${jobId}/scope-`);
  return uploadFile(BUCKETS.JOBS, fileBuffer, filename);
}

/**
 * Upload proof of work images
 */
async function uploadProofOfWork(fileBuffer, jobId, originalName) {
  const filename = generateFilename(originalName, `${jobId}/proof-`);
  return uploadFile(BUCKETS.JOBS, fileBuffer, filename);
}

/**
 * Upload portfolio image
 */
async function uploadPortfolioImage(fileBuffer, userId, originalName) {
  const filename = generateFilename(originalName, `${userId}/`);
  return uploadFile(BUCKETS.PORTFOLIO, fileBuffer, filename);
}

/**
 * Upload proof of payment (private bucket)
 */
async function uploadProofOfPayment(fileBuffer, jobId, originalName) {
  const filename = generateFilename(originalName, `${jobId}/`);
  return uploadFile(BUCKETS.PAYMENTS, fileBuffer, filename);
}

/**
 * Delete file from storage
 */
async function deleteFile(bucket, path) {
  try {
    const { error } = await supabase.storage
      .from(bucket)
      .remove([path]);

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Initialize storage buckets (run once)
 */
async function initBuckets() {
  const buckets = [
    { name: BUCKETS.PROFILES, public: true },
    { name: BUCKETS.JOBS, public: true },
    { name: BUCKETS.PORTFOLIO, public: true },
    { name: BUCKETS.PAYMENTS, public: false }
  ];

  for (const bucket of buckets) {
    try {
      const { error } = await supabase.storage.createBucket(bucket.name, {
        public: bucket.public
      });
      if (error && !error.message.includes('already exists')) {
        console.error(`Failed to create bucket ${bucket.name}: ${error.message}`);
      } else {
        console.log(`✓ Bucket ${bucket.name} ready`);
      }
    } catch (err) {
      console.error(`Bucket error: ${err.message}`);
    }
  }
}

module.exports = {
  BUCKETS,
  uploadFile,
  uploadProfileImage,
  uploadJobScopeImage,
  uploadProofOfWork,
  uploadPortfolioImage,
  uploadProofOfPayment,
  deleteFile,
  initBuckets
};
