const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { connectDB, isConnected } = require('./config/db');

// Load environment variables
dotenv.config();

// Create Express app
const app = express();

// Connect to MongoDB
connectDB();

// =============================================================================
// SECURITY MIDDLEWARE
// =============================================================================

// Helmet - Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Allow loading external resources
}));

// CORS - Configure allowed origins
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? [process.env.FRONTEND_URL, process.env.ADDITIONAL_FRONTEND_URL].filter(Boolean)
  : ['http://localhost:3000', 'http://localhost:3001'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Compression - Gzip compression for responses
app.use(compression());

// Rate limiting - General API protection
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to API routes
app.use('/api/', apiLimiter);

// Stricter rate limiting for file uploads
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 uploads per hour
  message: 'Too many uploads, please try again later.',
});

app.use('/api/assignments', uploadLimiter);
app.use('/api/submissions', uploadLimiter);
app.use('/api/projects', uploadLimiter);

// =============================================================================
// BODY PARSING MIDDLEWARE
// =============================================================================

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// =============================================================================
// DATABASE CONNECTION MIDDLEWARE
// =============================================================================

app.use('/api', (req, res, next) => {
  if (!isConnected()) {
    console.warn(`⚠️  Database not connected for ${req.method} ${req.path}`);
  }
  next();
});

// =============================================================================
// FILE STORAGE SETUP
// =============================================================================

// Create uploads directory if it doesn't exist (for development only)
// In production, files will be uploaded to Cloudflare R2
if (process.env.NODE_ENV !== 'production' || !process.env.R2_BUCKET_NAME) {
  const uploadsDir = path.join(__dirname, 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // Ensure project submission directories exist
  const projectCodeDir = path.join(__dirname, 'uploads', 'project-submissions', 'code');
  const projectReportDir = path.join(__dirname, 'uploads', 'project-submissions', 'reports');
  if (!fs.existsSync(projectCodeDir)) {
    fs.mkdirSync(projectCodeDir, { recursive: true });
  }
  if (!fs.existsSync(projectReportDir)) {
    fs.mkdirSync(projectReportDir, { recursive: true });
  }

  // Static file serving for development
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
}

// =============================================================================
// CLERK AUTHENTICATION MIDDLEWARE (Optional - Enable when ready)
// =============================================================================

// Uncomment when Clerk is configured
// const { ClerkExpressRequireAuth } = require('@clerk/clerk-sdk-node');
// const authMiddleware = ClerkExpressRequireAuth();
//
// // Protect all API routes (except health check)
// app.use('/api', (req, res, next) => {
//   // Skip auth for health check
//   if (req.path === '/health') return next();
//   // Apply auth middleware
//   return authMiddleware(req, res, next);
// });

// =============================================================================
// HEALTH CHECK ENDPOINT
// =============================================================================

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    database: isConnected() ? 'connected' : 'disconnected',
    environment: process.env.NODE_ENV || 'development',
  });
});

// =============================================================================
// API ROUTES
// =============================================================================

app.use('/api/assignments', require('./routes/assignments'));
app.use('/api/submissions', require('./routes/submissions'));
app.use('/api/projects', require('./routes/projects'));

// Base route
app.get('/', (req, res) => {
  res.json({
    message: 'EduGrade API is running',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      assignments: '/api/assignments',
      submissions: '/api/submissions',
      projects: '/api/projects',
    },
  });
});

// =============================================================================
// START WORKER PROCESSES
// =============================================================================

if (process.env.NODE_ENV !== 'test') {
  // Import queue configuration (will use BullMQ if Redis is configured)
  const queues = require('./config/queue');

  // Load queue processors
  require('./workers/assignmentProcessor');
  require('./workers/rubricProcessor');
  require('./workers/solutionProcessor');
  require('./workers/submissionProcessor');
  require('./workers/evaluationProcessor');
  require('./workers/projectProcessor');
  require('./workers/orchestrationProcessor');

  console.log('✅ Document processing workers initialized');

  // Check Redis connection for BullMQ
  if (process.env.REDIS_URL) {
    console.log('✅ BullMQ queue system initialized with Redis');
  } else {
    console.log('⚠️  Using in-memory queue (development only - jobs will be lost on restart)');
  }
}

// =============================================================================
// ERROR HANDLING MIDDLEWARE
// =============================================================================

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Error:', err);

  // CORS errors
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      error: 'CORS Error',
      message: 'Origin not allowed',
    });
  }

  // Clerk authentication errors
  if (err.status === 401 || err.statusCode === 401) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required',
    });
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      message: err.message,
      details: err.errors,
    });
  }

  // Mongoose errors
  if (err.name === 'CastError') {
    return res.status(400).json({
      error: 'Invalid ID',
      message: 'Invalid resource ID format',
    });
  }

  // Default error
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message,
    message: process.env.NODE_ENV === 'production'
      ? 'Something went wrong'
      : err.stack,
  });
});

// =============================================================================
// GRACEFUL SHUTDOWN
// =============================================================================

process.on('SIGTERM', () => {
  console.log('⚠️  SIGTERM received. Shutting down gracefully...');

  // Close server
  server.close(() => {
    console.log('✅ Server closed');

    // Close database connection
    mongoose.connection.close(false, () => {
      console.log('✅ Database connection closed');
      process.exit(0);
    });
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('❌ Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
});

// =============================================================================
// START SERVER
// =============================================================================

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log(`🚀 EduGrade Server Running`);
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`💾 Database: ${isConnected() ? 'Connected' : 'Connecting...'}`);
  console.log(`🔐 Auth: ${process.env.CLERK_SECRET_KEY ? 'Enabled (Clerk)' : 'Disabled'}`);
  console.log(`📦 Storage: ${process.env.R2_BUCKET_NAME ? 'Cloudflare R2' : 'Local'}`);
  console.log(`🔄 Queue: ${process.env.REDIS_URL ? 'BullMQ (Redis)' : 'In-Memory'}`);
  console.log('='.repeat(50));
});

module.exports = app;
