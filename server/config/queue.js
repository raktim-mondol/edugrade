/**
 * Queue configuration for parallel document processing
 * Uses memory-based queue implementation that doesn't require Redis
 */
const dotenv = require('dotenv');
const memoryQueues = require('./memoryQueue');

// Load environment variables
dotenv.config();

console.log('Using in-memory queue implementation for job processing');

// Export the memory-based queue implementation
module.exports = memoryQueues;