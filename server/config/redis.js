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
    const redisUrl = process.env.REDIS_URL;

    // Parse the URL to check if it's TLS (rediss://)
    const isTLS = redisUrl.startsWith('rediss://');

    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        // Stop retrying after 3 attempts or on auth errors
        if (times > 3) {
          console.error('❌ Redis max retries reached, disabling cache');
          isConnected = false;
          return null; // Stop retrying
        }
        return Math.min(times * 200, 2000);
      },
      reconnectOnError: (err) => {
        // Don't reconnect on auth errors
        if (err.message.includes('WRONGPASS') || err.message.includes('NOAUTH')) {
          console.error('❌ Redis authentication failed - check REDIS_URL credentials');
          return false;
        }
        return true;
      },
      enableReadyCheck: true,
      connectTimeout: 10000,
      // TLS options for Upstash
      ...(isTLS && {
        tls: {
          rejectUnauthorized: false
        }
      })
    });

    redis.on('connect', () => {
      console.log('✅ Redis connected');
    });

    redis.on('ready', () => {
      isConnected = true;
      console.log('✅ Redis ready for commands');
    });

    redis.on('error', (err) => {
      // Only log once for auth errors
      if (err.message.includes('WRONGPASS') || err.message.includes('NOAUTH')) {
        if (isConnected !== false) {
          console.error('❌ Redis authentication failed - caching disabled');
          isConnected = false;
        }
      } else {
        console.error('❌ Redis error:', err.message);
        isConnected = false;
      }
    });

    redis.on('close', () => {
      isConnected = false;
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
    // Silently fail - caching is optional
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
