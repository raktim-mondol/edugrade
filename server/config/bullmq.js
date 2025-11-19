const { Queue, Worker } = require('bullmq');
const Redis = require('ioredis');

// Redis connection configuration
const getRedisConnection = () => {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    console.warn('⚠️  No REDIS_URL found - queue system will not persist jobs');
    return null;
  }

  try {
    const connection = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    connection.on('connect', () => {
      console.log('✅ Redis connected successfully');
    });

    connection.on('error', (err) => {
      console.error('❌ Redis connection error:', err.message);
    });

    return connection;
  } catch (error) {
    console.error('❌ Failed to initialize Redis:', error.message);
    return null;
  }
};

// Get shared Redis connection
const redisConnection = getRedisConnection();

// Queue configuration options
const queueOptions = redisConnection
  ? {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000, // Start with 5 seconds
        },
        removeOnComplete: {
          age: 24 * 3600, // Keep completed jobs for 24 hours
          count: 1000, // Keep last 1000 completed jobs
        },
        removeOnFail: {
          age: 7 * 24 * 3600, // Keep failed jobs for 7 days
        },
      },
    }
  : null;

// Create queues
const createQueue = (name) => {
  if (!redisConnection) {
    // Fallback to in-memory queue for development
    console.warn(`⚠️  Creating in-memory queue for ${name} (no persistence)`);
    return require('./memoryQueue')[`${name}Queue`];
  }

  return new Queue(name, queueOptions);
};

// Initialize all queues
const assignmentProcessingQueue = createQueue('assignmentProcessing');
const rubricProcessingQueue = createQueue('rubricProcessing');
const solutionProcessingQueue = createQueue('solutionProcessing');
const submissionProcessingQueue = createQueue('submissionProcessing');
const evaluationQueue = createQueue('evaluation');
const orchestrationQueue = createQueue('orchestration');
const projectProcessingQueue = createQueue('projectProcessing');

// Export queues
module.exports = {
  assignmentProcessingQueue,
  rubricProcessingQueue,
  solutionProcessingQueue,
  submissionProcessingQueue,
  evaluationQueue,
  orchestrationQueue,
  projectProcessingQueue,
  redisConnection,
};

// Helper function to create workers
const createWorker = (queueName, processor, options = {}) => {
  if (!redisConnection) {
    console.warn(`⚠️  Worker for ${queueName} using in-memory processing`);
    return null;
  }

  const worker = new Worker(queueName, processor, {
    connection: redisConnection,
    concurrency: options.concurrency || 1, // Process one job at a time by default
    limiter: {
      max: options.maxJobsPerInterval || 10,
      duration: options.limitDuration || 60000, // 1 minute
    },
    ...options,
  });

  // Event handlers
  worker.on('completed', (job) => {
    console.log(`✅ Job ${job.id} in queue ${queueName} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`❌ Job ${job?.id} in queue ${queueName} failed:`, err.message);
  });

  worker.on('error', (err) => {
    console.error(`❌ Worker error in ${queueName}:`, err.message);
  });

  console.log(`✅ Worker initialized for queue: ${queueName}`);
  return worker;
};

module.exports.createWorker = createWorker;
