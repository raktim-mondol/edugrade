const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const fs = require('fs');
const path = require('path');

// Check if R2 is configured
const isR2Configured = () => {
  return !!(
    process.env.R2_ENDPOINT &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME
  );
};

// Initialize R2 Client (S3-compatible)
let r2Client = null;

if (isR2Configured()) {
  try {
    r2Client = new S3Client({
      region: 'auto',
      endpoint: process.env.R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });
    console.log('✅ Cloudflare R2 storage configured');
  } catch (error) {
    console.error('❌ Failed to initialize R2 client:', error.message);
  }
} else {
  console.warn('⚠️  R2 not configured - using local file storage');
}

/**
 * Upload file to Cloudflare R2
 * @param {Buffer} fileBuffer - File buffer
 * @param {String} fileName - Original file name
 * @param {String} mimeType - MIME type
 * @param {String} folder - Folder path (e.g., 'assignments', 'submissions')
 * @returns {Promise<String>} - File URL or local path
 */
async function uploadFile(fileBuffer, fileName, mimeType, folder = 'uploads') {
  // Use R2 if configured
  if (r2Client && isR2Configured()) {
    try {
      const key = `${folder}/${Date.now()}-${fileName}`;

      const upload = new Upload({
        client: r2Client,
        params: {
          Bucket: process.env.R2_BUCKET_NAME,
          Key: key,
          Body: fileBuffer,
          ContentType: mimeType,
        },
      });

      const result = await upload.done();

      // Return public URL if available, otherwise construct it
      const publicUrl = process.env.R2_PUBLIC_URL
        ? `${process.env.R2_PUBLIC_URL}/${key}`
        : `${process.env.R2_ENDPOINT}/${process.env.R2_BUCKET_NAME}/${key}`;

      console.log(`✅ File uploaded to R2: ${key}`);
      return publicUrl;
    } catch (error) {
      console.error('❌ R2 upload failed:', error.message);
      // Fallback to local storage
      return saveLocally(fileBuffer, fileName, folder);
    }
  }

  // Fallback to local storage
  return saveLocally(fileBuffer, fileName, folder);
}

/**
 * Save file locally (fallback or development)
 * @param {Buffer} fileBuffer
 * @param {String} fileName
 * @param {String} folder
 * @returns {String} - Local file path
 */
function saveLocally(fileBuffer, fileName, folder) {
  const uploadsDir = path.join(__dirname, '..', 'uploads', folder);

  // Create directory if it doesn't exist
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const filePath = path.join(uploadsDir, `${Date.now()}-${fileName}`);
  fs.writeFileSync(filePath, fileBuffer);

  console.log(`📁 File saved locally: ${filePath}`);

  // Return relative path
  return `uploads/${folder}/${path.basename(filePath)}`;
}

/**
 * Get file URL (for serving)
 * @param {String} filePath - Stored file path or URL
 * @returns {String} - Accessible URL
 */
function getFileUrl(filePath) {
  // If it's already a full URL, return as-is
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
    return filePath;
  }

  // If R2 is configured and path looks like R2 key
  if (isR2Configured() && !filePath.startsWith('uploads/')) {
    return `${process.env.R2_PUBLIC_URL}/${filePath}`;
  }

  // Local file - return relative path (will be served by Express static middleware)
  return `/${filePath}`;
}

/**
 * Delete file from storage
 * @param {String} filePath - File path or URL
 * @returns {Promise<Boolean>} - Success status
 */
async function deleteFile(filePath) {
  // If it's an R2 URL
  if (filePath.startsWith('http') && r2Client) {
    try {
      // Extract key from URL
      const url = new URL(filePath);
      const key = url.pathname.substring(1); // Remove leading slash

      await r2Client.send(
        new DeleteObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: key,
        })
      );

      console.log(`✅ File deleted from R2: ${key}`);
      return true;
    } catch (error) {
      console.error('❌ R2 delete failed:', error.message);
      return false;
    }
  }

  // Local file
  try {
    const fullPath = path.join(__dirname, '..', filePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      console.log(`✅ Local file deleted: ${filePath}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error('❌ Local file delete failed:', error.message);
    return false;
  }
}

/**
 * Generate signed URL for temporary access (R2 only)
 * @param {String} key - File key in R2
 * @param {Number} expiresIn - Expiration time in seconds
 * @returns {Promise<String>} - Signed URL
 */
async function getSignedFileUrl(key, expiresIn = 3600) {
  if (!r2Client || !isR2Configured()) {
    throw new Error('R2 not configured');
  }

  try {
    const command = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
    });

    const signedUrl = await getSignedUrl(r2Client, command, { expiresIn });
    return signedUrl;
  } catch (error) {
    console.error('❌ Failed to generate signed URL:', error.message);
    throw error;
  }
}

module.exports = {
  uploadFile,
  getFileUrl,
  deleteFile,
  getSignedFileUrl,
  isR2Configured: isR2Configured(),
};
