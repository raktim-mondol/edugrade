# MVP Deployment Guide - EduGrade

**Quick Start Guide for Deploying EduGrade to Production (FREE Tier)**

Total Cost: **$6-15/month** for first 100 users

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Step 1: MongoDB Atlas Setup (FREE)](#step-1-mongodb-atlas-setup-free)
3. [Step 2: Redis Setup (FREE)](#step-2-redis-setup-free)
4. [Step 3: Clerk Authentication Setup (FREE)](#step-3-clerk-authentication-setup-free)
5. [Step 4: Cloudflare R2 Storage (FREE)](#step-4-cloudflare-r2-storage-free)
6. [Step 5: Railway Backend Deployment](#step-5-railway-backend-deployment)
7. [Step 6: Vercel Frontend Deployment (FREE)](#step-6-vercel-frontend-deployment-free)
8. [Step 7: Configure Environment Variables](#step-7-configure-environment-variables)
9. [Step 8: Testing & Verification](#step-8-testing--verification)
10. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- **GitHub Account** (for deploying code)
- **Credit Card** (for some services, but won't be charged on free tier)
- **Domain Name** (optional, ~$10/year from Namecheap or Cloudflare)

**Time to Complete**: ~2-3 hours

---

## Step 1: MongoDB Atlas Setup (FREE)

MongoDB Atlas provides a FREE 512MB cluster - perfect for MVP!

### Instructions:

1. **Create Account**
   - Go to: https://www.mongodb.com/cloud/atlas/register
   - Sign up with email or Google

2. **Create a Free Cluster**
   - Click **"Build a Database"**
   - Select **"M0 FREE"** tier
   - Choose cloud provider: **AWS** (recommended)
   - Region: Choose closest to your users (e.g., US East, EU West)
   - Cluster Name: `edugrade-production`
   - Click **"Create"**

3. **Create Database User**
   - Go to **Database Access** (left sidebar)
   - Click **"Add New Database User"**
   - Username: `edugrade_user`
   - Password: Click **"Autogenerate Secure Password"** → **COPY THIS!**
   - User Privileges: **"Read and write to any database"**
   - Click **"Add User"**

4. **Whitelist IP Addresses**
   - Go to **Network Access** (left sidebar)
   - Click **"Add IP Address"**
   - Click **"Allow Access from Anywhere"** (0.0.0.0/0)
   - Confirm → This allows Railway to connect

5. **Get Connection String**
   - Go to **Database** → **Connect**
   - Select **"Connect your application"**
   - Driver: **Node.js**, Version: **5.5 or later**
   - Copy the connection string:
     ```
     mongodb+srv://edugrade_user:<password>@edugrade-production.xxxxx.mongodb.net/?retryWrites=true&w=majority
     ```
   - Replace `<password>` with your actual password
   - Add database name: `/edugrade` before the `?`
     ```
     mongodb+srv://edugrade_user:YOUR_PASSWORD@edugrade-production.xxxxx.mongodb.net/edugrade?retryWrites=true&w=majority
     ```

✅ **Save this connection string** - you'll need it for Railway!

---

## Step 2: Redis Setup (FREE)

We'll use **Upstash** - serverless Redis with a generous free tier.

### Instructions:

1. **Create Account**
   - Go to: https://upstash.com
   - Sign up with email or GitHub

2. **Create Redis Database**
   - Click **"Create Database"**
   - Name: `edugrade-queue`
   - Type: **Regional** (cheaper)
   - Region: Choose same as MongoDB (e.g., us-east-1)
   - TLS: **Enabled** (default)
   - Eviction: **No eviction** (important for queue)
   - Click **"Create"**

3. **Get Connection URL**
   - Click on your database name
   - Copy **"UPSTASH_REDIS_REST_URL"** or **"Redis Connection String"**
   - Should look like:
     ```
     rediss://default:YOUR_PASSWORD@YOUR_HOST.upstash.io:6379
     ```

✅ **Save this Redis URL** - you'll need it for Railway!

**Free Tier Limits**:
- 10,000 commands/day
- 256 MB storage
- Perfect for ~100 assignments/day

---

## Step 3: Clerk Authentication Setup (FREE)

Clerk provides user authentication with 10,000 free monthly active users.

### Instructions:

1. **Create Account**
   - Go to: https://clerk.com
   - Sign up with email or GitHub

2. **Create Application**
   - Click **"Create Application"**
   - Application name: `EduGrade`
   - Select sign-in options:
     - ✅ Email
     - ✅ Google (recommended)
     - ✅ GitHub (optional)
   - Click **"Create Application"**

3. **Get API Keys**
   - Go to **API Keys** (left sidebar)
   - Copy:
     - **Publishable Key** (starts with `pk_live_` or `pk_test_`)
     - **Secret Key** (starts with `sk_live_` or `sk_test_`)

4. **Configure Settings** (Optional but Recommended)
   - Go to **User & Authentication** → **Email, Phone, Username**
   - Enable: **Email address** (required), **Name** (optional)
   - Go to **Paths** → Set sign-in path: `/sign-in`, sign-up path: `/sign-up`

✅ **Save both keys** - you'll need them for Railway and Vercel!

**Free Tier Limits**:
- 10,000 monthly active users
- Unlimited sign-ups
- All authentication methods included

---

## Step 4: Cloudflare R2 Storage (FREE)

Cloudflare R2 is S3-compatible with NO egress fees and 10GB free storage.

### Instructions:

1. **Create Cloudflare Account**
   - Go to: https://dash.cloudflare.com/sign-up
   - Sign up with email

2. **Enable R2**
   - Go to **R2** in sidebar
   - Click **"Purchase R2 Plan"** (Free tier)
   - Confirm (no credit card charged for free tier)

3. **Create Bucket**
   - Click **"Create Bucket"**
   - Bucket name: `edugrade-files`
   - Region: **Automatic** (uses nearest location)
   - Click **"Create Bucket"**

4. **Create API Token**
   - Go to **R2** → **Manage R2 API Tokens**
   - Click **"Create API Token"**
   - Token name: `edugrade-backend`
   - Permissions: **Object Read & Write**
   - TTL: **Forever**
   - Click **"Create API Token"**
   - **COPY AND SAVE**:
     - Access Key ID
     - Secret Access Key
     - Endpoint URL

5. **Enable Public Access** (Optional - for direct file access)
   - Go to your bucket → **Settings**
   - Under **Public Access**, click **"Allow Access"**
   - Copy the **Public Bucket URL**

✅ **Save these credentials**:
- R2_ENDPOINT (e.g., `https://xxxxx.r2.cloudflarestorage.com`)
- R2_ACCESS_KEY_ID
- R2_SECRET_ACCESS_KEY
- R2_BUCKET_NAME: `edugrade-files`
- R2_PUBLIC_URL (if enabled)

**Free Tier Limits**:
- 10 GB storage
- 1 million Class A operations/month
- 10 million Class B operations/month
- **ZERO egress fees** (huge savings!)

---

## Step 5: Railway Backend Deployment

Railway makes it easy to deploy Node.js apps with built-in Redis support.

### Instructions:

1. **Push Code to GitHub**
   ```bash
   # If not already done
   git add .
   git commit -m "Prepare for production deployment"
   git push origin main
   ```

2. **Create Railway Account**
   - Go to: https://railway.app
   - Sign up with **GitHub** (easiest for deployment)

3. **Create New Project**
   - Click **"New Project"**
   - Select **"Deploy from GitHub repo"**
   - Authorize Railway to access your repos
   - Select your `edugrade` repository

4. **Configure Service**
   - Railway will auto-detect Node.js
   - Click on the service → **Settings**
   - **Build Command**: `cd server && npm install`
   - **Start Command**: `cd server && npm start`
   - **Root Directory**: Leave as `/` (since we have `railway.json`)
   - **Health Check Path**: `/api/health`

5. **Add Environment Variables**
   - Click **Variables** tab
   - Add the following variables:

   ```env
   NODE_ENV=production
   PORT=5000

   # MongoDB
   MONGO_URI=mongodb+srv://edugrade_user:YOUR_PASSWORD@...

   # Redis (from Upstash)
   REDIS_URL=rediss://default:YOUR_PASSWORD@...

   # Gemini AI
   GEMINI_API_KEY=your_gemini_api_key
   GEMINI_MODEL=gemini-2.0-flash-exp

   # Clerk Auth
   CLERK_SECRET_KEY=sk_live_xxxxxxxxxxxx

   # Cloudflare R2
   R2_ENDPOINT=https://xxxxx.r2.cloudflarestorage.com
   R2_ACCESS_KEY_ID=your_access_key
   R2_SECRET_ACCESS_KEY=your_secret_key
   R2_BUCKET_NAME=edugrade-files
   R2_PUBLIC_URL=https://files.yourdomain.com

   # Frontend URL (you'll update this after Vercel deployment)
   FRONTEND_URL=https://yourdomain.vercel.app
   ```

6. **Deploy**
   - Click **"Deploy"**
   - Wait 2-5 minutes for build to complete
   - Check **Deployments** tab for status

7. **Get Backend URL**
   - Go to **Settings** → **Domains**
   - Copy the Railway-provided URL:
     ```
     https://edugrade-production.up.railway.app
     ```
   - Or add custom domain (requires DNS configuration)

8. **Test Backend**
   - Visit: `https://your-backend-url.railway.app/api/health`
   - Should see:
     ```json
     {
       "status": "healthy",
       "database": "connected",
       "environment": "production"
     }
     ```

✅ **Save your Railway backend URL** - you'll need it for frontend!

**Railway Free Tier**:
- $5 credit/month
- ~500 hours of usage
- Perfect for MVP testing

---

## Step 6: Vercel Frontend Deployment (FREE)

Vercel is perfect for React apps with automatic deployments.

### Instructions:

1. **Create Vercel Account**
   - Go to: https://vercel.com/signup
   - Sign up with **GitHub** (easiest)

2. **Import Project**
   - Click **"Add New Project"**
   - Select your `edugrade` repository
   - Click **"Import"**

3. **Configure Build Settings**
   - Framework Preset: **Create React App**
   - Root Directory: `client` ← **IMPORTANT!**
   - Build Command: `npm run build`
   - Output Directory: `build`
   - Install Command: `npm install`

4. **Add Environment Variables**
   - Click **"Environment Variables"**
   - Add:
     ```env
     REACT_APP_API_URL=https://your-backend-url.railway.app
     REACT_APP_CLERK_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxx
     ```

5. **Deploy**
   - Click **"Deploy"**
   - Wait 2-3 minutes for build
   - Check build logs for any errors

6. **Get Frontend URL**
   - Copy your Vercel URL:
     ```
     https://edugrade.vercel.app
     ```
   - Or add custom domain: **Settings** → **Domains**

7. **Update Railway CORS**
   - Go back to Railway
   - Update `FRONTEND_URL` variable to your Vercel URL
   - Redeploy backend (click **"Redeploy"**)

✅ **Your app is now LIVE!**

Visit: `https://edugrade.vercel.app`

**Vercel Free Tier**:
- Unlimited sites
- 100 GB bandwidth/month
- Automatic HTTPS
- Serverless functions (100 GB-hours)

---

## Step 7: Configure Environment Variables

### Backend (.env on Railway)

Already configured in Step 5, but here's the complete reference:

```env
NODE_ENV=production
PORT=5000
MONGO_URI=mongodb+srv://...
REDIS_URL=rediss://...
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.0-flash-exp
CLERK_SECRET_KEY=sk_live_...
R2_ENDPOINT=https://...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=edugrade-files
R2_PUBLIC_URL=https://...
FRONTEND_URL=https://edugrade.vercel.app
```

### Frontend (.env on Vercel)

```env
REACT_APP_API_URL=https://your-backend.railway.app
REACT_APP_CLERK_PUBLISHABLE_KEY=pk_live_...
```

---

## Step 8: Testing & Verification

### 1. Test Backend Health

```bash
curl https://your-backend.railway.app/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "database": "connected",
  "environment": "production"
}
```

### 2. Test Frontend

1. Visit: `https://edugrade.vercel.app`
2. Should see the EduGrade homepage
3. Try creating an assignment:
   - Upload a PDF
   - Check if it uploads to R2 (check Cloudflare R2 dashboard)
   - Verify processing works

### 3. Test Authentication (if Clerk is enabled)

1. Click **"Sign In"**
2. Create account with email
3. Verify you can access protected routes

### 4. Check Queue System

1. Upload an assignment
2. Check Railway logs: **Deployments** → **View Logs**
3. Should see:
   ```
   ✅ BullMQ queue system initialized with Redis
   ✅ Assignment processing started
   ```

### 5. Test File Storage

1. Upload a submission
2. Check Cloudflare R2 dashboard → `edugrade-files` bucket
3. Files should appear in `/submissions/` folder

---

## Troubleshooting

### Issue: "Database not connected"

**Solution**:
1. Check MongoDB Atlas → Network Access
2. Ensure `0.0.0.0/0` is whitelisted
3. Verify connection string is correct in Railway
4. Check MongoDB Atlas → Database Users (user exists with correct password)

### Issue: "CORS Error" in browser

**Solution**:
1. Verify `FRONTEND_URL` in Railway matches your Vercel URL exactly
2. No trailing slash: ✅ `https://edugrade.vercel.app` ❌ `https://edugrade.vercel.app/`
3. Redeploy Railway backend after changing

### Issue: "Redis connection failed"

**Solution**:
1. Check Upstash dashboard → Database is active
2. Verify `REDIS_URL` in Railway is correct
3. Ensure URL starts with `rediss://` (with TLS)

### Issue: "File upload fails"

**Solution**:
1. Check Cloudflare R2 → API tokens are valid
2. Verify `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` in Railway
3. Check bucket name matches exactly
4. Verify bucket permissions (Object Read & Write)

### Issue: "Workers not processing jobs"

**Solution**:
1. Check Railway logs for errors
2. Verify Redis connection is working
3. Ensure `GEMINI_API_KEY` is valid
4. Check Gemini API quota: https://makersuite.google.com/app/apikey

### Issue: Railway deployment fails

**Solution**:
1. Check build logs in Railway
2. Ensure `package.json` has all dependencies
3. Verify `railway.json` configuration
4. Try manual redeploy: **Deployments** → **Redeploy**

### Issue: Vercel build fails

**Solution**:
1. Check build logs in Vercel
2. Ensure `Root Directory` is set to `client`
3. Verify all environment variables are set
4. Run `npm run build` locally to test

---

## Cost Monitoring

### Free Tier Limits:

| Service | Free Tier | What Happens When Exceeded |
|---------|-----------|----------------------------|
| **Railway** | $5 credit/month | Service pauses until next month or upgrade |
| **MongoDB Atlas** | 512 MB | Upgrade required ($9/mo for 2GB) |
| **Upstash Redis** | 10k commands/day | Requests throttled or charged |
| **Clerk** | 10k MAU | Billing starts at $25/mo + $0.02/user |
| **Cloudflare R2** | 10 GB storage | $0.015/GB after that |
| **Vercel** | 100 GB bandwidth | Service throttled or upgrade ($20/mo) |

### Expected Usage (100 Active Users):

- **Railway**: ~$3-5/month (well within free credit)
- **MongoDB**: ~50 MB used (within free tier)
- **Redis**: ~5,000 commands/day (within free tier)
- **Clerk**: 100 users (within free tier)
- **R2**: ~2-3 GB (within free tier)
- **Vercel**: ~20 GB bandwidth (within free tier)

**Total**: **$0-5/month** for first 100 users! 🎉

---

## Next Steps After MVP

### 1. Add Custom Domain (~$10/year)

**Namecheap**: Buy domain → Point to Vercel/Railway
- Frontend: `edugrade.com` → Vercel
- Backend: `api.edugrade.com` → Railway

### 2. Enable Monitoring (Optional)

- **Sentry** (Error tracking): Free tier available
- **LogTail** (Logging): $5/month
- **Plausible** (Analytics): $9/month

### 3. Scale Up (When Needed)

**At 500 Users**:
- Railway: Upgrade to $20/mo plan
- MongoDB: M10 cluster ($57/mo)
- Redis: Pay-as-you-go (~$10/mo)
- **Total**: ~$200/month

**At 1000+ Users**:
- Consider revenue model (see PRODUCTION_DEPLOYMENT_GUIDE.md)
- Suggested pricing: $0.10/submission or $29/month subscriptions

---

## Support & Resources

- **Railway Docs**: https://docs.railway.app
- **Vercel Docs**: https://vercel.com/docs
- **MongoDB Atlas Docs**: https://docs.atlas.mongodb.com
- **Clerk Docs**: https://clerk.com/docs
- **Cloudflare R2 Docs**: https://developers.cloudflare.com/r2

---

## Summary Checklist

- [ ] MongoDB Atlas cluster created + connection string saved
- [ ] Upstash Redis database created + URL saved
- [ ] Clerk application created + API keys saved
- [ ] Cloudflare R2 bucket created + credentials saved
- [ ] Code pushed to GitHub
- [ ] Railway backend deployed + URL saved
- [ ] Vercel frontend deployed + URL saved
- [ ] All environment variables configured
- [ ] Health check endpoint working
- [ ] Test assignment upload works
- [ ] Test submission evaluation works
- [ ] CORS configured correctly

🎉 **Congratulations! Your MVP is LIVE!** 🎉

---

**Need Help?**
- Check the [PRODUCTION_DEPLOYMENT_GUIDE.md](./PRODUCTION_DEPLOYMENT_GUIDE.md) for advanced topics
- Review [CLAUDE.md](./CLAUDE.md) for codebase documentation
- Open an issue in the GitHub repository
