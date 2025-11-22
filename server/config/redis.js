const Redis = require('ioredis');

let redis = null;
let isConnected = false;

// Initialize Redis connection
function initRedis() {
  if (!process.env.REDIS_URL) {
    console.log('⚠️ REDIS_URL not configured, caching disabled');
    return null;
  }

  try {
    redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      enableReadyCheck: true,
      connectTimeout: 5000,
      lazyConnect: true
    });

    redis.on('connect', () => {
      isConnected = true;
      console.log('✅ Redis connected');
    });

    redis.on('error', (err) => {
      console.error('❌ Redis error:', err.message);
      isConnected = false;
    });

    redis.on('close', () => {
      isConnected = false;
    });

    // Connect
    redis.connect().catch(err => {
      console.error('❌ Redis connection failed:', err.message);
    });

    return redis;
  } catch (error) {
    console.error('❌ Failed to initialize Redis:', error.message);
    return null;
  }
}

// Get cached data
async function getCache(key) {
  if (!redis || !isConnected) return null;

  try {
    const data = await redis.get(key);
    if (data) {
      return JSON.parse(data);
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
    if (keys.length > 0) {
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
