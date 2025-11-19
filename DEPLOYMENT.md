# EduGrade Deployment Options

This document helps you choose the right deployment path for your needs.

---

## Quick Start (Recommended)

**Want to deploy in 2-3 hours with FREE services?**

👉 **Follow the [MVP_DEPLOYMENT_GUIDE.md](./MVP_DEPLOYMENT_GUIDE.md)**

- Total Cost: **$0-15/month** for first 100 users
- Stack: Railway + MongoDB Atlas + Upstash Redis + Clerk + Cloudflare R2 + Vercel
- All using FREE tiers!

---

## Production Deployment (Scaling to 1000+ Users)

**Need advanced features, monitoring, and scalability?**

👉 **Follow the [PRODUCTION_DEPLOYMENT_GUIDE.md](./PRODUCTION_DEPLOYMENT_GUIDE.md)**

- Complete production stack with monitoring
- Payment integration (Stripe)
- Advanced security
- Cost projections at scale
- Multi-tier pricing strategies

---

## Local Development

**Just want to run locally for development?**

### Prerequisites
- Node.js 18+ and npm
- MongoDB (local or cloud)

### Setup

1. **Clone repository**
   ```bash
   git clone https://github.com/raktim-mondol/edugrade.git
   cd edugrade
   ```

2. **Install backend dependencies**
   ```bash
   cd server
   npm install
   cp .env.example .env
   # Edit .env with your local settings
   ```

3. **Install frontend dependencies**
   ```bash
   cd ../client
   npm install
   ```

4. **Start development servers**

   **Option 1: Separate terminals**
   ```bash
   # Terminal 1 - Backend
   cd server
   npm start

   # Terminal 2 - Frontend
   cd client
   npm start
   ```

   **Option 2: Startup scripts**
   ```bash
   # Linux/Mac
   ./start.sh

   # Windows
   start.bat
   ```

5. **Access the app**
   - Frontend: http://localhost:3000
   - Backend: http://localhost:5000

---

## Comparison: Development vs MVP vs Production

| Feature | Local Development | MVP (Free Tier) | Production |
|---------|-------------------|-----------------|------------|
| **Cost** | $0 | $0-15/mo | $200-1500/mo |
| **Users** | 1 (you) | 100 | 10,000+ |
| **Database** | Local MongoDB | MongoDB Atlas Free | MongoDB Atlas M10+ |
| **Queue** | In-memory | Upstash Redis Free | Redis Cloud |
| **Auth** | Disabled | Clerk Free | Clerk Pro |
| **Storage** | Local files | R2 Free (10GB) | R2 Paid |
| **Hosting** | localhost | Railway Free + Vercel | Railway Pro + Vercel |
| **Monitoring** | Console logs | None | Sentry + LogTail |
| **Uptime** | When running | 99%+ | 99.9%+ |
| **SSL/HTTPS** | No | Yes (automatic) | Yes (automatic) |
| **Custom Domain** | No | Yes | Yes |
| **Backups** | Manual | Auto (Atlas) | Auto + redundancy |

---

## Deployment Checklist

### Before Deploying

- [ ] Code tested locally
- [ ] All dependencies in package.json
- [ ] .env.example files updated
- [ ] Security review completed
- [ ] Database models finalized
- [ ] API endpoints documented

### For MVP Deployment

- [ ] GitHub repository created
- [ ] MongoDB Atlas account + cluster
- [ ] Upstash Redis account + database
- [ ] Clerk account + application
- [ ] Cloudflare account + R2 bucket
- [ ] Railway account + project
- [ ] Vercel account + project
- [ ] All environment variables configured
- [ ] Health check endpoint working
- [ ] CORS configured

### For Production Deployment

- [ ] All MVP items above
- [ ] Stripe account + products configured
- [ ] Custom domain purchased
- [ ] DNS configured
- [ ] Sentry for error tracking
- [ ] LogTail for logging
- [ ] Analytics setup (Plausible/GA)
- [ ] Monitoring alerts configured
- [ ] Backup strategy implemented
- [ ] Security audit completed
- [ ] Load testing performed
- [ ] Documentation updated

---

## Getting Help

- **MVP Deployment Issues**: See [MVP_DEPLOYMENT_GUIDE.md](./MVP_DEPLOYMENT_GUIDE.md) → Troubleshooting section
- **Production Setup**: See [PRODUCTION_DEPLOYMENT_GUIDE.md](./PRODUCTION_DEPLOYMENT_GUIDE.md)
- **Codebase Questions**: See [CLAUDE.md](./CLAUDE.md)
- **Bug Reports**: Open an issue on GitHub

---

## Recommended Path

```
1. Start with Local Development (1-2 days)
   ↓
2. Deploy MVP with FREE tier (2-3 hours)
   ↓
3. Test with beta users (1-2 weeks)
   ↓
4. Scale to Production when ready (1 week)
   ↓
5. Add payment/monetization (1 week)
```

---

**Ready to deploy?** Start with the [MVP_DEPLOYMENT_GUIDE.md](./MVP_DEPLOYMENT_GUIDE.md)!
