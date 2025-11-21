const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

const LANDING_AI_API_URL = 'https://api.va.landing.ai/v1/ade/parse';
const LANDING_AI_API_KEY = process.env.LANDING_AI_API_KEY;
const LANDING_AI_MODEL = process.env.LANDING_AI_MODEL || 'dpt-2-latest';

// Rate limiting
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 2000; // 2 seconds between calls

/**
 * Enforce rate limiting for Landing AI API
 */
async function enforceRateLimit() {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
    console.log(`⏳ Landing AI rate limit: waiting ${waitTime}ms`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  lastRequestTime = Date.now();
}

/**
 * Extract content from PDF using Landing AI API
 * @param {string} pdfPath - Path to PDF file
 * @returns {Object} Extracted content with text, tables, images
 */
async function extractPDFContent(pdfPath) {
  if (!LANDING_AI_API_KEY) {
    console.log('⚠️ LANDING_AI_API_KEY is not configured - will use direct Gemini processing');
    throw new Error('LANDING_AI_API_KEY is not configured');
  }

  // Verify file exists
  if (!fs.existsSync(pdfPath)) {
    console.error(`❌ PDF file not found: ${pdfPath}`);
    throw new Error(`PDF file not found: ${pdfPath}`);
  }

  await enforceRateLimit();

  const form = new FormData();
  form.append('document', fs.createReadStream(pdfPath));
  form.append('model', LANDING_AI_MODEL);

  try {
    console.log(`🔄 Landing AI: Extracting content from ${pdfPath}`);
    console.log(`   Model: ${LANDING_AI_MODEL}`);
    console.log(`   API URL: ${LANDING_AI_API_URL}`);

    const response = await axios.post(LANDING_AI_API_URL, form, {
      headers: {
        'Authorization': `Bearer ${LANDING_AI_API_KEY}`,
        ...form.getHeaders()
      },
      timeout: 120000, // 2 minute timeout for large PDFs
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });

    console.log('✅ Landing AI extraction completed');
    console.log(`   Response status: ${response.status}`);
    console.log(`   Response data type: ${typeof response.data}`);
    console.log(`   Response data keys: ${response.data ? Object.keys(response.data).join(', ') : 'N/A'}`);

    return {
      success: true,
      data: response.data,
      extractedAt: new Date().toISOString(),
      sourceFile: pdfPath
    };
  } catch (error) {
    console.error('❌ Landing AI extraction failed:', error.message);

    if (error.response) {
      console.error('   Response status:', error.response.status);
      console.error('   Response data:', JSON.stringify(error.response.data).substring(0, 500));
    }

    throw new Error(`PDF extraction failed: ${error.message}`);
  }
}

/**
 * Extract content with retry logic
 * @param {string} pdfPath - Path to PDF file
 * @param {number} maxRetries - Maximum number of retries
 * @returns {Object} Extracted content
 */
async function extractWithRetry(pdfPath, maxRetries = 3) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await extractPDFContent(pdfPath);
    } catch (error) {
      lastError = error;

      // Don't retry on certain errors
      if (error.message.includes('not found') ||
          error.message.includes('not configured')) {
        throw error;
      }

      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff: 2s, 4s, 8s
        console.log(`🔄 Landing AI retry ${attempt}/${maxRetries} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Format extracted content for Gemini processing
 * @param {Object} extractedData - Raw data from Landing AI
 * @returns {string} Formatted text content
 */
function formatExtractedContent(extractedData) {
  console.log('📝 formatExtractedContent called');

  if (!extractedData || !extractedData.data) {
    console.log('   ⚠️ No data to format, returning empty string');
    return '';
  }

  const data = extractedData.data;
  console.log(`   Data type: ${typeof data}`);
  console.log(`   Data keys: ${typeof data === 'object' ? Object.keys(data).join(', ') : 'N/A'}`);

  let formattedContent = '';

  // Handle different response formats from Landing AI
  if (typeof data === 'string') {
    formattedContent = data;
  } else if (data.text) {
    formattedContent = data.text;
  } else if (data.markdown) {
    formattedContent = data.markdown;
  } else if (data.chunks) {
    // Handle chunked response
    formattedContent = data.chunks
      .map(chunk => chunk.text || chunk.content || '')
      .join('\n\n');
  } else if (Array.isArray(data)) {
    // Handle array of pages/sections
    formattedContent = data
      .map(item => item.text || item.content || JSON.stringify(item))
      .join('\n\n');
  } else {
    // Fallback: stringify the data
    formattedContent = JSON.stringify(data, null, 2);
  }

  return formattedContent;
}

/**
 * Check if Landing AI service is configured
 * @returns {boolean}
 */
function isConfigured() {
  const configured = !!LANDING_AI_API_KEY;
  console.log(`🔧 Landing AI configured: ${configured}`);
  if (!configured) {
    console.log('   ⚠️ LANDING_AI_API_KEY not set - will use direct Gemini PDF processing');
  }
  return configured;
}

module.exports = {
  extractPDFContent,
  extractWithRetry,
  formatExtractedContent,
  isConfigured
};
