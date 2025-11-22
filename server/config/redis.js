const { Redis } = require('@upstash/redis');

let redis = null;
let isConnected = false;

// Initialize Redis connection using Upstash REST API
function initRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    console.log('⚠️ UPSTASH_REDIS_REST_URL/TOKEN not configured, caching disabled');
    return null;
  }

  try {
    redis = new Redis({
      url,
      token
    });

    isConnected = true;
    console.log('✅ Redis (Upstash REST) initialized');

    return redis;
  } catch (error) {
    console.error('❌ Failed to initialize Redis:', error.message);
    isConnected = false;
    return null;
  }
}

// Get cached data
async function getCache(key) {
  if (!redis || !isConnected) return null;

  try {
    const data = await redis.get(key);
    if (data) {
      // Upstash REST already parses JSON, but handle both cases
      if (typeof data === 'string') {
        return JSON.parse(data);
      }
      return data;
    }
    return null;
  } catch (error) {
    console.error('Cache get error:', error.message);
    return null;
  }
}

// Set cached data with TTL (default 30 seconds)
async function setCache(key, data, ttlSeconds = 30) {
  if (!redis || !isConnected) return false;

  try {
    await redis.setex(key, ttlSeconds, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error('Cache set error:', error.message);
    return false;
  }
}

// Delete cached data
async function deleteCache(key) {
  if (!redis || !isConnected) return false;

  try {
    await redis.del(key);
    return true;
  } catch (error) {
    console.error('Cache delete error:', error.message);
    return false;
  }
}

// Delete multiple keys by pattern
async function deleteCachePattern(pattern) {
  if (!redis || !isConnected) return false;

  try {
    const keys = await redis.keys(pattern);
    if (keys && keys.length > 0) {
      await redis.del(...keys);
    }
    return true;
  } catch (error) {
    console.error('Cache pattern delete error:', error.message);
    return false;
  }
}

// Cache keys helpers
const cacheKeys = {
  assignmentStatus: (id) => `assignment:status:${id}`,
  assignmentData: (id) => `assignment:data:${id}`,
  submissions: (assignmentId) => `submissions:${assignmentId}`,
  userAssignments: (userId) => `user:assignments:${userId}`
};

// Check if Redis is available
function isRedisConnected() {
  return isConnected;
}

// Get Redis client
function getRedisClient() {
  return redis;
}

module.exports = {
  initRedis,
  getCache,
  setCache,
  deleteCache,
  deleteCachePattern,
  cacheKeys,
  isRedisConnected,
  getRedisClient
};
