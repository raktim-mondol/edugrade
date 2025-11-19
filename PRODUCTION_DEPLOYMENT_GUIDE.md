# Production Deployment Guide for EduGrade

**Last Updated**: 2025-11-19
**Purpose**: Complete guide to deploy EduGrade as a production SaaS product

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Backend Hosting](#backend-hosting)
3. [Database Solutions](#database-solutions)
4. [Authentication & User Management](#authentication--user-management)
5. [Payment Processing](#payment-processing)
6. [File Storage](#file-storage)
7. [Security Considerations](#security-considerations)
8. [Monitoring & Analytics](#monitoring--analytics)
9. [Cost Breakdown](#cost-breakdown)
10. [Step-by-Step Implementation](#step-by-step-implementation)

---

## Architecture Overview

### Current State (Development)
```
React App (localhost:3000) → Express Server (localhost:5000) → MongoDB (localhost:27017)
                                    ↓
                              Gemini API
```

### Recommended Production Architecture
```
┌─────────────────────────────────────────────────────────────────┐
│                         User's Browser                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    CDN (Cloudflare/Vercel)                      │
│                   React App (Static Files)                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                   Backend API (Node.js/Express)                 │
│                    Hosted on: Railway/Render                    │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │ Auth Service │  │ Queue System │  │ Payment Webhooks   │  │
│  │  (Clerk)     │  │ (BullMQ +    │  │ (Stripe)           │  │
│  │              │  │  Redis)      │  │                    │  │
│  └──────────────┘  └──────────────┘  └────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
              ↓                  ↓                    ↓
    ┌─────────────────┐  ┌──────────────┐  ┌─────────────────┐
    │  MongoDB Atlas  │  │ Redis Cloud  │  │  AWS S3 / R2    │
    │  (Database)     │  │ (Queue Jobs) │  │ (File Storage)  │
    └─────────────────┘  └──────────────┘  └─────────────────┘
                              ↓
                    ┌─────────────────────┐
                    │   External APIs     │
                    │  - Gemini API       │
                    │  - Email (Resend)   │
                    └─────────────────────┘
```

---

## Backend Hosting

### Recommended: Railway (Best for This Project) ⭐

**Why Railway?**
- Easy deployment from GitHub
- Built-in Redis support (for queue system)
- Automatic HTTPS
- Generous free tier ($5 credit/month)
- Simple environment variable management
- WebSocket support
- No cold starts

**Pricing:**
- Free: $5 credit/month (good for development/testing)
- Pro: $20/month + usage (production-ready)
- Estimated cost: $30-50/month for small-medium scale

**Deployment Steps:**
```bash
# 1. Install Railway CLI
npm install -g @railway/cli

# 2. Login
railway login

# 3. Initialize project
railway init

# 4. Deploy
railway up
```

**Configuration:**
```javascript
// railway.json
{
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "cd server && npm install"
  },
  "deploy": {
    "startCommand": "cd server && npm start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### Alternative Options

#### 1. **Render** (Similar to Railway)
- **Pros**: Free tier available, easy setup, auto-deploy from Git
- **Cons**: Cold starts on free tier (services spin down after 15 min)
- **Pricing**: Free tier → $7/month/service
- **Best for**: MVP/testing before scaling

#### 2. **Vercel** (Frontend + Serverless Backend)
- **Pros**: Excellent for Next.js, generous free tier
- **Cons**: 10s serverless timeout (not ideal for long AI processing)
- **Pricing**: Free → $20/month
- **Note**: Would require architecture changes (separate API hosting)

#### 3. **AWS EC2 + Elastic Beanstalk**
- **Pros**: Full control, scalable, reliable
- **Cons**: Complex setup, higher learning curve
- **Pricing**: $20-100+/month depending on instance size
- **Best for**: Large-scale deployments with DevOps expertise

#### 4. **DigitalOcean App Platform**
- **Pros**: Simple, predictable pricing, good documentation
- **Cons**: Limited free tier
- **Pricing**: $5/month (basic) → $12/month (professional)
- **Best for**: Cost-conscious deployments

#### 5. **Heroku**
- **Pros**: Easy to use, mature platform
- **Cons**: Removed free tier, expensive for scale
- **Pricing**: $7/month/dyno minimum
- **Note**: Good but more expensive than alternatives

### Recommendation: **Railway**
- Best balance of ease-of-use, performance, and cost
- Native Redis support for queue system
- No cold starts (critical for background processing)

---

## Database Solutions

### Recommended: MongoDB Atlas (Official MongoDB Cloud) ⭐

**Why MongoDB Atlas?**
- Official MongoDB hosting
- Free tier (512MB storage, shared cluster)
- Automatic backups
- Built-in monitoring
- Global deployment options
- Easy scaling

**Pricing:**
- **Free (M0)**: 512MB storage, shared CPU (perfect for MVP)
- **M10**: $57/month (dedicated, 10GB storage)
- **M20**: $131/month (dedicated, 20GB storage)

**Setup:**
```bash
# 1. Create account at mongodb.com/cloud/atlas
# 2. Create cluster (choose AWS/Google Cloud region near your users)
# 3. Add database user
# 4. Whitelist IP addresses (or allow from anywhere: 0.0.0.0/0)
# 5. Get connection string
```

**Connection String:**
```
mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/edugrade?retryWrites=true&w=majority
```

**Environment Variable:**
```env
MONGO_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/edugrade?retryWrites=true&w=majority
```

### Alternative Options

#### 1. **MongoDB Atlas (Shared M0)** - FREE ⭐
- **Storage**: 512MB
- **Best for**: MVP, up to ~100 assignments
- **Limitations**: Shared resources, no backups beyond 2 days

#### 2. **Railway MongoDB Plugin**
- **Pros**: Integrated with Railway hosting
- **Cons**: More expensive than Atlas
- **Pricing**: Pay-per-use (~$15-30/month)

#### 3. **AWS DocumentDB**
- **Pros**: MongoDB-compatible, AWS integration
- **Cons**: Expensive, complex setup
- **Pricing**: $200+/month
- **Best for**: Enterprise only

### Additional Service: Redis Cloud (for Queue System)

**Why Redis?**
- Current implementation uses in-memory queue (lost on restart)
- Production needs persistent queue with BullMQ + Redis
- Job recovery and monitoring

**Recommended: Upstash Redis** (Serverless)
- **Free tier**: 10,000 commands/day
- **Pricing**: Pay-per-request (~$5-10/month for moderate use)
- **Pros**: No infrastructure management, global edge network
- **Setup**: https://upstash.com

**Alternative: Redis Cloud (RedisLabs)**
- **Free tier**: 30MB storage
- **Pricing**: $5/month → $15/month
- **Pros**: Managed service, automatic failover

---

## Authentication & User Management

### Recommended: Clerk ⭐ (Modern, Easy Integration)

**Why Clerk?**
- Pre-built React components
- Email, social login (Google, GitHub, etc.)
- Magic links, OTP
- User management dashboard
- Organizations/teams support
- Role-based access control (RBAC)
- Webhook support
- Excellent DX (Developer Experience)

**Pricing:**
- **Free**: 10,000 MAU (Monthly Active Users)
- **Pro**: $25/month + $0.02/MAU
- **Perfect for**: Educational SaaS (most schools <10k users)

**Integration:**

```bash
npm install @clerk/clerk-react @clerk/clerk-sdk-node
```

**Frontend (client/src/index.js):**
```javascript
import { ClerkProvider } from '@clerk/clerk-react';

const clerkPubKey = process.env.REACT_APP_CLERK_PUBLISHABLE_KEY;

ReactDOM.render(
  <ClerkProvider publishableKey={clerkPubKey}>
    <App />
  </ClerkProvider>,
  document.getElementById('root')
);
```

**Protected Routes (client/src/App.js):**
```javascript
import { SignedIn, SignedOut, RedirectToSignIn, useUser } from '@clerk/clerk-react';

function App() {
  return (
    <Router>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Home />} />

        {/* Protected routes */}
        <Route path="/assignments/*" element={
          <>
            <SignedIn>
              <AssignmentList />
            </SignedIn>
            <SignedOut>
              <RedirectToSignIn />
            </SignedOut>
          </>
        } />
      </Routes>
    </Router>
  );
}
```

**Backend Middleware (server/middleware/auth.js):**
```javascript
const { ClerkExpressRequireAuth } = require('@clerk/clerk-sdk-node');

// Protect all API routes
app.use('/api', ClerkExpressRequireAuth());

// Access user info in controllers
exports.createAssignment = async (req, res) => {
  const userId = req.auth.userId; // From Clerk
  const assignment = await Assignment.create({
    ...req.body,
    instructorId: userId
  });
  res.json(assignment);
};
```

### Alternative Options

#### 1. **Auth0** (Enterprise-Grade)
- **Pros**: Very robust, enterprise features, compliance (SOC2, HIPAA)
- **Cons**: More complex, higher cost at scale
- **Pricing**: Free (7,000 MAU) → $35/month + usage
- **Best for**: Enterprise customers, strict compliance needs

#### 2. **Firebase Auth** (Google)
- **Pros**: Free tier generous, integrates with Google services
- **Cons**: Vendor lock-in to Google ecosystem
- **Pricing**: Free (unlimited users) → Pay for advanced features
- **Best for**: Google Cloud users

#### 3. **Supabase Auth** (Open Source)
- **Pros**: Open source, generous free tier, PostgreSQL-backed
- **Cons**: Still maturing, fewer integrations
- **Pricing**: Free (50,000 MAU) → $25/month
- **Best for**: Budget-conscious, open-source preference

#### 4. **NextAuth.js** (Self-Hosted)
- **Pros**: Free, full control, flexible
- **Cons**: You manage everything (security, scaling, etc.)
- **Pricing**: Free (hosting costs only)
- **Best for**: Technical teams wanting full control

#### 5. **AWS Cognito**
- **Pros**: AWS integration, scalable
- **Cons**: Complex setup, poor DX
- **Pricing**: Free (50,000 MAU) → $0.0055/MAU
- **Best for**: Already on AWS

### Recommendation: **Clerk**
- Best developer experience
- Pre-built UI components
- Perfect for educational SaaS pricing
- Easy to implement (2-3 hours)

---

## Payment Processing

### Recommended: Stripe ⭐ (Industry Standard)

**Why Stripe?**
- Most popular, trusted by users
- Excellent documentation
- Subscriptions + one-time payments
- Usage-based billing (perfect for per-submission pricing)
- Automatic invoicing
- Tax handling (Stripe Tax)
- 135+ currencies
- Developer-friendly APIs

**Pricing:**
- 2.9% + $0.30 per transaction (US cards)
- 3.9% + $0.30 (international cards)
- No monthly fees

**Business Models for EduGrade:**

#### Option 1: Subscription Tiers
```
Free Tier:
- 5 assignments/month
- 50 submissions/month
- Email support

Educator ($29/month):
- Unlimited assignments
- 500 submissions/month
- Priority support
- Excel export

Institution ($99/month):
- Unlimited everything
- Multi-user accounts
- API access
- Dedicated support
- White-labeling
```

#### Option 2: Usage-Based (Recommended for EduGrade)
```
Pay-per-use:
- $0.10 per submission evaluated
- $5 minimum/month
- Volume discounts:
  - 100-500 submissions: $0.08 each
  - 500-1000: $0.06 each
  - 1000+: $0.04 each
```

#### Option 3: Hybrid
```
Basic ($19/month):
- 100 submissions included
- $0.10 per additional submission

Pro ($49/month):
- 500 submissions included
- $0.08 per additional submission

Enterprise (Custom):
- Unlimited submissions
- Custom pricing
```

**Implementation:**

```bash
npm install stripe
```

**Backend (server/utils/stripe.js):**
```javascript
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Create subscription
exports.createSubscription = async (customerId, priceId) => {
  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    payment_behavior: 'default_incomplete',
    expand: ['latest_invoice.payment_intent'],
  });
  return subscription;
};

// Create usage-based charge
exports.recordSubmissionUsage = async (subscriptionItemId, quantity) => {
  const usageRecord = await stripe.subscriptionItems.createUsageRecord(
    subscriptionItemId,
    {
      quantity: quantity,
      timestamp: Math.floor(Date.now() / 1000),
      action: 'increment',
    }
  );
  return usageRecord;
};

// Webhook handler (for payment confirmations)
exports.handleWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {
    case 'invoice.payment_succeeded':
      // Activate user subscription
      break;
    case 'invoice.payment_failed':
      // Notify user
      break;
    case 'customer.subscription.deleted':
      // Downgrade user to free tier
      break;
  }

  res.json({ received: true });
};
```

**Frontend (client/src/components/Pricing.js):**
```javascript
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);

function CheckoutForm({ priceId }) {
  const stripe = useStripe();
  const elements = useElements();

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Create subscription on backend
    const { clientSecret } = await fetch('/api/create-subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priceId })
    }).then(r => r.json());

    // Confirm payment
    const { error } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: {
        card: elements.getElement(CardElement)
      }
    });

    if (error) {
      console.error(error);
    } else {
      // Success! Redirect to dashboard
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <CardElement />
      <button type="submit" disabled={!stripe}>Subscribe</button>
    </form>
  );
}
```

### Alternative Options

#### 1. **Paddle** (Merchant of Record)
- **Pros**: Handles all tax/VAT, simpler compliance
- **Cons**: Higher fees (5% + payment processing)
- **Pricing**: 5% + 2.9% + $0.50 per transaction
- **Best for**: Global sales, avoiding tax complexity

#### 2. **LemonSqueezy**
- **Pros**: Merchant of Record, easy setup, beautiful checkout
- **Cons**: Newer, higher fees
- **Pricing**: 5% + payment processing
- **Best for**: Digital products, international sales

#### 3. **PayPal**
- **Pros**: Widely known, trusted
- **Cons**: Higher fees, poor developer experience
- **Pricing**: 3.49% + $0.49 per transaction
- **Best for**: Users who prefer PayPal

### Recommendation: **Stripe** (Usage-Based Model)
- Best for per-submission pricing
- Flexible subscription options
- Trusted brand
- Suggested pricing: **$0.10/submission** or **$29/month for 500 submissions**

---

## File Storage

### Current: Local File System (`/uploads`)
**Problem**: Files lost if server restarts/scales horizontally

### Recommended: Cloudflare R2 ⭐ (S3-Compatible, No Egress Fees)

**Why Cloudflare R2?**
- S3-compatible API (easy migration)
- **Zero egress fees** (huge savings vs S3)
- 10GB free storage
- Fast global CDN
- Cheap: $0.015/GB storage

**Pricing:**
- Free: 10GB storage, 1M Class A operations/month
- Paid: $0.015/GB storage (vs S3's $0.023/GB + egress)
- **Save 80%+ vs AWS S3 for high-traffic files**

**Integration:**

```bash
npm install @aws-sdk/client-s3 @aws-sdk/lib-storage
```

**Configuration (server/config/storage.js):**
```javascript
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');

const r2Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT, // https://xxxxx.r2.cloudflarestorage.com
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

// Upload file
async function uploadToR2(fileBuffer, fileName, mimeType) {
  const upload = new Upload({
    client: r2Client,
    params: {
      Bucket: process.env.R2_BUCKET_NAME,
      Key: `submissions/${Date.now()}-${fileName}`,
      Body: fileBuffer,
      ContentType: mimeType,
    },
  });

  const result = await upload.done();
  return result.Location;
}

// Get file URL
function getFileUrl(key) {
  return `${process.env.R2_PUBLIC_URL}/${key}`;
}

module.exports = { uploadToR2, getFileUrl };
```

**Update Multer (server/routes/submissions.js):**
```javascript
const multer = require('multer');
const { uploadToR2 } = require('../config/storage');

// Use memory storage instead of disk
const upload = multer({ storage: multer.memoryStorage() });

// In controller
exports.uploadSubmission = async (req, res) => {
  const file = req.file;

  // Upload to R2
  const fileUrl = await uploadToR2(file.buffer, file.originalname, file.mimetype);

  const submission = await Submission.create({
    submissionFile: fileUrl, // Store R2 URL instead of local path
    // ... other fields
  });

  res.json(submission);
};
```

### Alternative Options

#### 1. **AWS S3** (Industry Standard)
- **Pros**: Most reliable, battle-tested
- **Cons**: Expensive egress fees (~$0.09/GB)
- **Pricing**: $0.023/GB storage + egress
- **Best for**: AWS ecosystem users

#### 2. **Backblaze B2**
- **Pros**: Cheapest storage ($0.005/GB), free egress to Cloudflare
- **Cons**: Slower than S3/R2
- **Pricing**: $0.005/GB storage + $0.01/GB egress
- **Best for**: Budget-focused, archival

#### 3. **DigitalOcean Spaces**
- **Pros**: Simple pricing, S3-compatible
- **Cons**: Limited regions
- **Pricing**: $5/month (250GB storage + 1TB transfer)
- **Best for**: DigitalOcean users

### Recommendation: **Cloudflare R2**
- Best price/performance
- Zero egress fees (critical for PDF downloads)
- S3-compatible (easy to switch later)

---

## Security Considerations

### Essential Security Measures

#### 1. **Environment Variables**
```env
# Never commit these! Use platform secrets
NODE_ENV=production
MONGO_URI=mongodb+srv://...
GEMINI_API_KEY=...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
CLERK_SECRET_KEY=sk_live_...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
SESSION_SECRET=generate_random_64_char_string
```

#### 2. **CORS Configuration**
```javascript
// server/server.js
const cors = require('cors');

app.use(cors({
  origin: process.env.FRONTEND_URL || 'https://yourdomain.com',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

#### 3. **Rate Limiting**
```bash
npm install express-rate-limit
```

```javascript
const rateLimit = require('express-rate-limit');

// General API rate limit
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many requests, please try again later.'
});

app.use('/api/', apiLimiter);

// Stricter limit for uploads
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 uploads per hour
});

app.use('/api/submissions', uploadLimiter);
```

#### 4. **Helmet (Security Headers)**
```bash
npm install helmet
```

```javascript
const helmet = require('helmet');
app.use(helmet());
```

#### 5. **File Upload Validation**
```javascript
const multer = require('multer');

const fileFilter = (req, file, cb) => {
  // Whitelist allowed file types
  const allowedTypes = ['application/pdf', 'application/x-ipynb+json'];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF and IPYNB allowed.'), false);
  }
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max
  },
  fileFilter: fileFilter
});
```

#### 6. **Input Sanitization**
```bash
npm install express-validator
```

```javascript
const { body, validationResult } = require('express-validator');

app.post('/api/assignments',
  body('title').trim().isLength({ min: 3, max: 200 }).escape(),
  body('description').trim().isLength({ max: 5000 }).escape(),
  body('totalPoints').isInt({ min: 1, max: 1000 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    // ... proceed
  }
);
```

#### 7. **HTTPS Only**
```javascript
// Redirect HTTP to HTTPS
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production' && !req.secure) {
    return res.redirect('https://' + req.headers.host + req.url);
  }
  next();
});
```

#### 8. **Database Security**
- Enable MongoDB Atlas IP Whitelist
- Use strong passwords (generated)
- Enable audit logs
- Regular backups

---

## Monitoring & Analytics

### Recommended Stack

#### 1. **Sentry** (Error Tracking) - FREE tier available
```bash
npm install @sentry/node @sentry/react
```

**Backend:**
```javascript
const Sentry = require('@sentry/node');

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
});

// Error handler
app.use(Sentry.Handlers.errorHandler());
```

**Frontend:**
```javascript
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: process.env.REACT_APP_SENTRY_DSN,
  environment: process.env.NODE_ENV,
});
```

**Pricing:** Free (5,000 events/month) → $29/month

#### 2. **LogTail / Better Stack** (Logging)
- Centralized logging
- Real-time log streaming
- Free tier: 1GB/month
- Pricing: $5/month → $25/month

#### 3. **Plausible / PostHog** (Analytics)
- Privacy-friendly (GDPR compliant)
- No cookie banners needed
- Track: page views, user flows, feature usage
- Pricing: $9/month (10k pageviews)

#### 4. **UptimeRobot** (Uptime Monitoring)
- Free tier: 50 monitors
- Alerts via email/SMS when site goes down
- 5-minute checks

---

## Cost Breakdown

### Startup Budget (MVP - First 100 Users)

| Service | Tier | Monthly Cost |
|---------|------|--------------|
| **Hosting (Railway)** | Hobby | $5 (free credit) |
| **Database (MongoDB Atlas)** | M0 Free | $0 |
| **Redis (Upstash)** | Free | $0 |
| **Auth (Clerk)** | Free | $0 (up to 10k MAU) |
| **Storage (Cloudflare R2)** | Free | $0 (up to 10GB) |
| **Payment (Stripe)** | Per-transaction | 2.9% + $0.30 |
| **Error Tracking (Sentry)** | Free | $0 |
| **Domain (Namecheap)** | .com | $12/year (~$1/mo) |
| **SSL Certificate** | Let's Encrypt | Free |
| **Email (Resend)** | Free | $0 (100 emails/day) |
| **TOTAL** | | **~$6/month** |

### Growth Budget (500-1,000 Users)

| Service | Tier | Monthly Cost |
|---------|------|--------------|
| **Hosting (Railway)** | Pro | $40 |
| **Database (MongoDB Atlas)** | M10 Dedicated | $57 |
| **Redis (Upstash)** | Pay-as-you-go | $10 |
| **Auth (Clerk)** | Pro | $25 + usage (~$10) |
| **Storage (Cloudflare R2)** | 100GB | $1.50 |
| **Payment (Stripe)** | Per-transaction | 2.9% of revenue |
| **Error Tracking (Sentry)** | Team | $29 |
| **Email (Resend)** | Growth | $20 |
| **Monitoring (LogTail)** | Starter | $5 |
| **TOTAL** | | **~$197/month** |

### Enterprise Budget (10,000+ Users)

| Service | Tier | Monthly Cost |
|---------|------|--------------|
| **Hosting (Railway)** | Pro + Scale | $200 |
| **Database (MongoDB Atlas)** | M40 or higher | $500 |
| **Redis** | Dedicated | $50 |
| **Auth (Clerk)** | Pro + usage | $250 |
| **Storage (Cloudflare R2)** | 1TB | $15 |
| **CDN (Cloudflare)** | Pro | $20 |
| **Payment (Stripe)** | Per-transaction | 2.9% of revenue |
| **Monitoring Suite** | Full stack | $200 |
| **Support & Backup** | Various | $100 |
| **TOTAL** | | **~$1,335/month** |

**Revenue Projection** (at $0.10/submission):
- 10,000 users × 20 submissions/month = 200,000 submissions
- Revenue: $20,000/month
- Infrastructure: $1,335/month (6.7% of revenue)
- **Profit Margin: 93%+** (excluding salaries, marketing)

---

## Step-by-Step Implementation

### Phase 1: Backend & Database (Week 1)

#### Day 1-2: MongoDB Atlas Setup
```bash
# 1. Create MongoDB Atlas account
# 2. Create free M0 cluster
# 3. Create database user
# 4. Get connection string
# 5. Update .env

MONGO_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/edugrade?retryWrites=true&w=majority
```

#### Day 3-4: Railway Deployment
```bash
# 1. Push code to GitHub
git add .
git commit -m "Prepare for production deployment"
git push origin main

# 2. Create Railway account
# 3. New Project → Deploy from GitHub
# 4. Select repository
# 5. Add environment variables:
#    - MONGO_URI
#    - GEMINI_API_KEY
#    - NODE_ENV=production
# 6. Deploy!
```

#### Day 5-7: Redis + Queue Migration
```bash
npm install bullmq ioredis
```

**Update server/config/queue.js:**
```javascript
const { Queue, Worker } = require('bullmq');
const Redis = require('ioredis');

const connection = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null
});

const assignmentQueue = new Queue('assignment', { connection });
const submissionQueue = new Queue('submission', { connection });
// ... other queues

module.exports = {
  assignmentQueue,
  submissionQueue,
  // ...
};
```

**Update workers to use BullMQ:**
```javascript
const { Worker } = require('bullmq');
const connection = new Redis(process.env.REDIS_URL);

const worker = new Worker('assignment', async (job) => {
  // Your processing logic
  await processAssignment(job.data);
}, { connection });

worker.on('completed', (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed:`, err);
});
```

### Phase 2: Authentication (Week 2)

#### Day 1-3: Clerk Integration
```bash
# 1. Create Clerk account
# 2. Create application
# 3. Get API keys

cd client
npm install @clerk/clerk-react

cd ../server
npm install @clerk/clerk-sdk-node
```

**Frontend setup:**
```javascript
// client/src/index.js
import { ClerkProvider } from '@clerk/clerk-react';

ReactDOM.render(
  <ClerkProvider publishableKey={process.env.REACT_APP_CLERK_PUBLISHABLE_KEY}>
    <App />
  </ClerkProvider>,
  document.getElementById('root')
);
```

**Backend middleware:**
```javascript
// server/middleware/auth.js
const { ClerkExpressRequireAuth } = require('@clerk/clerk-sdk-node');

module.exports = ClerkExpressRequireAuth();

// server/server.js
const authMiddleware = require('./middleware/auth');
app.use('/api', authMiddleware); // Protect all API routes
```

#### Day 4-7: User Model Updates
```javascript
// Update Assignment model
assignmentSchema.add({
  instructorId: {
    type: String, // Clerk user ID
    required: true,
    index: true
  },
  organizationId: String // For team accounts
});

// Update controllers to use authenticated user
exports.createAssignment = async (req, res) => {
  const userId = req.auth.userId;
  // ... create assignment with userId
};

// Add authorization checks
exports.getAssignment = async (req, res) => {
  const assignment = await Assignment.findById(req.params.id);

  if (assignment.instructorId !== req.auth.userId) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  res.json(assignment);
};
```

### Phase 3: File Storage (Week 3)

#### Day 1-4: Cloudflare R2 Setup
```bash
# 1. Create Cloudflare account
# 2. Go to R2 → Create bucket
# 3. Create API token with R2 edit permissions
# 4. Get credentials

npm install @aws-sdk/client-s3 @aws-sdk/lib-storage
```

**Migrate file uploads:**
```javascript
// Before (local storage)
const upload = multer({ dest: 'uploads/assignments/' });

// After (R2 storage)
const upload = multer({ storage: multer.memoryStorage() });

router.post('/assignments', upload.single('assignment'), async (req, res) => {
  // Upload to R2
  const fileUrl = await uploadToR2(
    req.file.buffer,
    req.file.originalname,
    req.file.mimetype
  );

  // Save URL to database
  const assignment = await Assignment.create({
    assignmentFile: fileUrl, // R2 URL
    // ...
  });
});
```

#### Day 5-7: Migration Script for Existing Files
```javascript
// scripts/migrate-to-r2.js
const fs = require('fs');
const path = require('path');
const { uploadToR2 } = require('../server/config/storage');
const Assignment = require('../server/models/assignment');

async function migrateFiles() {
  const assignments = await Assignment.find({});

  for (const assignment of assignments) {
    if (assignment.assignmentFile && assignment.assignmentFile.startsWith('uploads/')) {
      const localPath = path.join(__dirname, '..', assignment.assignmentFile);
      const buffer = fs.readFileSync(localPath);
      const fileName = path.basename(localPath);

      const r2Url = await uploadToR2(buffer, fileName, 'application/pdf');

      assignment.assignmentFile = r2Url;
      await assignment.save();

      console.log(`Migrated: ${fileName}`);
    }
  }
}

migrateFiles();
```

### Phase 4: Payment Integration (Week 4)

#### Day 1-3: Stripe Setup
```bash
# 1. Create Stripe account
# 2. Get API keys (test mode first)
# 3. Create products and prices in Stripe Dashboard

npm install stripe @stripe/stripe-js @stripe/react-stripe-js
```

**Create subscription tiers in Stripe:**
- Free tier (no Stripe needed)
- Educator: $29/month
- Institution: $99/month

#### Day 4-5: Backend Integration
```javascript
// server/routes/billing.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

router.post('/create-checkout-session', authMiddleware, async (req, res) => {
  const { priceId } = req.body;
  const userId = req.auth.userId;

  const session = await stripe.checkout.sessions.create({
    customer_email: req.auth.claims.email,
    client_reference_id: userId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.FRONTEND_URL}/pricing`,
  });

  res.json({ url: session.url });
});

router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;
      // Update user subscription status in database
      await User.findOneAndUpdate(
        { clerkId: session.client_reference_id },
        {
          subscriptionStatus: 'active',
          subscriptionTier: 'educator',
          stripeCustomerId: session.customer,
          stripeSubscriptionId: session.subscription
        }
      );
      break;
  }

  res.json({ received: true });
});
```

#### Day 6-7: Frontend Pricing Page
```javascript
// client/src/pages/Pricing.js
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);

function Pricing() {
  const handleSubscribe = async (priceId) => {
    const response = await fetch('/api/billing/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priceId })
    });

    const { url } = await response.json();
    window.location.href = url; // Redirect to Stripe Checkout
  };

  return (
    <div className="pricing-tiers">
      <div className="tier">
        <h3>Educator</h3>
        <p>$29/month</p>
        <button onClick={() => handleSubscribe('price_xxxxx')}>
          Subscribe
        </button>
      </div>
      {/* More tiers */}
    </div>
  );
}
```

### Phase 5: Production Hardening (Week 5-6)

#### Security Checklist
```bash
npm install helmet express-rate-limit express-validator cors
```

✅ Enable CORS with specific origins
✅ Add rate limiting
✅ Input validation
✅ Error tracking (Sentry)
✅ Logging (LogTail)
✅ Environment variables secured
✅ HTTPS enforced
✅ File upload limits
✅ MongoDB IP whitelist
✅ Stripe webhooks verified

#### Performance Optimization
- Enable gzip compression
- Add CDN for static assets (Cloudflare)
- Database indexing
- Query optimization
- Caching (Redis)

#### Testing
- Load testing with Artillery/k6
- Security audit with npm audit
- Penetration testing basics
- User acceptance testing

---

## Domain & SSL

### Domain Registration
- **Namecheap**: ~$12/year for .com
- **Cloudflare Registrar**: At-cost pricing (~$8-10/year)
- **Google Domains**: $12/year (now Squarespace)

### DNS & CDN
- **Cloudflare** (FREE): DNS + CDN + DDoS protection
- Point domain to Railway/Render backend
- Point frontend to Vercel/Cloudflare Pages

### SSL Certificate
- **Let's Encrypt** (FREE): Automatic with Railway/Render/Vercel
- **Cloudflare**: Automatic SSL

---

## Email Service

### Transactional Emails (Notifications, Receipts)

**Recommended: Resend** (Modern, Developer-Friendly)
- Free: 100 emails/day, 3,000/month
- Pricing: $20/month for 50,000 emails
- React Email templates
- Great DX

**Alternative: SendGrid**
- Free: 100 emails/day
- Pricing: $15/month for 40,000 emails

**Use Cases:**
- Welcome emails
- Assignment completion notifications
- Payment receipts
- Password resets

---

## Recommended Tech Stack Summary

| Component | Service | Why | Cost |
|-----------|---------|-----|------|
| **Backend Hosting** | Railway | No cold starts, Redis included | $5-40/mo |
| **Database** | MongoDB Atlas | Official, reliable, free tier | Free-$57/mo |
| **Queue/Cache** | Upstash Redis | Serverless, pay-per-use | Free-$10/mo |
| **Authentication** | Clerk | Best DX, generous free tier | Free-$35/mo |
| **Payment** | Stripe | Industry standard, best features | 2.9% + $0.30 |
| **File Storage** | Cloudflare R2 | No egress fees, S3-compatible | Free-$5/mo |
| **Frontend Hosting** | Vercel | Optimal for React, free SSL | Free |
| **Email** | Resend | Modern, great templates | Free-$20/mo |
| **Error Tracking** | Sentry | Industry standard | Free-$29/mo |
| **Analytics** | Plausible | Privacy-friendly | $9/mo |
| **Domain** | Cloudflare | At-cost + free CDN | $8-10/year |

**Total MVP Cost**: ~$6-15/month
**Total Growth Cost**: ~$200-300/month (500-1000 users)
**Total Enterprise Cost**: ~$1,300-1,500/month (10,000+ users)

---

## Next Steps

1. **Week 1**: Set up MongoDB Atlas + Railway + Deploy basic version
2. **Week 2**: Integrate Clerk authentication
3. **Week 3**: Migrate files to Cloudflare R2
4. **Week 4**: Add Stripe payments + pricing page
5. **Week 5**: Security hardening + monitoring
6. **Week 6**: Beta testing + bug fixes
7. **Week 7**: Marketing site + documentation
8. **Week 8**: Launch! 🚀

---

## Additional Resources

- **Railway Docs**: https://docs.railway.app
- **MongoDB Atlas Docs**: https://docs.atlas.mongodb.com
- **Clerk Docs**: https://clerk.com/docs
- **Stripe Docs**: https://stripe.com/docs
- **Cloudflare R2 Docs**: https://developers.cloudflare.com/r2

---

**Questions or need help?** Create an issue in the repository or consult the specific service documentation.

Good luck with your production launch! 🎓
