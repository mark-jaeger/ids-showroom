# ISSUE-009: Railway Deployment and Hosting Setup

**Status**: ✅ RESOLVED
**Date**: 2024-11-20
**Prepared**: 2024-11-20
**Resolved**: 2025-11-21
**Type**: Deployment - Infrastructure
**Component**: DevOps, Deployment
**Assignee**: Claude Code
**Depends On**: ISSUE-005 ✅
**Priority**: High

---

## Resolution Summary

**Deployment Status**: ✅ **LIVE** at https://catalog.ids.online
**Deployed On**: 2025-11-21
**Database**: 29,342 products imported and operational
**Features**: All working (listing, search, filtering, detail pages)

### Issues Resolved During Deployment:
1. App binding (localhost → 0.0.0.0)
2. Database connection (DATABASE_URL not set)
3. Service identification (multi-service project)
4. DNS configuration (correct Railway URL)
5. Health check configuration

**Resolution Commits**: 051188a, 5a32737, af99df4, b335ad2

---

## Objective

Set up production hosting on Railway.app for the IDS Showroom catalog application, including database hosting, environment configuration, and CI/CD deployment pipeline.

---

## Railway Overview

**Railway.app** is a modern cloud platform that simplifies deployment:
- Easy Node.js and PostgreSQL hosting
- Automatic HTTPS certificates
- Environment variable management
- GitHub integration for automatic deployments
- Generous free tier, scalable pricing
- Built-in monitoring and logs

**Why Railway:**
- Simpler than AWS/Azure/GCP
- Better DX than Heroku
- PostgreSQL included
- One-click deployments
- No credit card required for trial

---

## Implementation Plan

### 1. Prepare Application for Production

#### A. Create Production Configuration

**File:** `.env.production` (new file, NOT committed to git)
```env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://user:pass@host:port/dbname
```

**File:** `.env.example` (new file, committed to git)
```env
# Environment Configuration
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL=postgresql://user:password@localhost/database_name

# Optional: Session secret (for future auth)
SESSION_SECRET=your-secret-key-here
```

#### B. Update .gitignore

**File:** `.gitignore` (modify)
```
node_modules/
.env
.env.production
.env.local
*.log
.DS_Store
```

#### C. Add Production Database Pool Configuration

**File:** `src/config/database.js` (modify)

```javascript
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false // Railway requires this
    } : false,
    max: 20, // Maximum pool size
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Test connection on startup
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('❌ Database connection failed:', err);
        process.exit(1);
    } else {
        console.log('✓ Database connection established');
    }
});

module.exports = pool;
```

#### D. Add Health Check Endpoint

**File:** `src/routes/health.js` (new file)

```javascript
const express = require('express');
const router = express.Router();
const db = require('../config/database');

/**
 * GET /health
 * Health check endpoint for monitoring
 */
router.get('/health', async (req, res) => {
    try {
        // Check database connection
        await db.query('SELECT 1');

        res.status(200).json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            database: 'connected',
            environment: process.env.NODE_ENV
        });
    } catch (error) {
        res.status(503).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            database: 'disconnected',
            error: error.message
        });
    }
});

module.exports = router;
```

**Mount in app.js:**
```javascript
const healthRoutes = require('./routes/health');
app.use('/', healthRoutes);
```

#### E. Graceful Shutdown Handling

**File:** `src/app.js` (modify)

```javascript
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
        db.end(() => {
            console.log('Database pool closed');
            process.exit(0);
        });
    });
});
```

### 2. Railway Project Setup

#### A. Create Railway Account
1. Go to https://railway.app
2. Sign up with GitHub account
3. Verify email

#### B. Create New Project
1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Connect GitHub account
4. Select `ids-showroom` repository
5. Railway auto-detects Node.js app

#### C. Add PostgreSQL Database
1. In Railway project dashboard
2. Click "New" → "Database" → "Add PostgreSQL"
3. Railway provisions database automatically
4. Database URL auto-added to environment variables

### 3. Configure Environment Variables

In Railway project settings:

```
NODE_ENV=production
PORT=3000
DATABASE_URL=${{Postgres.DATABASE_URL}}  # Auto-injected by Railway
```

Railway automatically injects `DATABASE_URL` when PostgreSQL is added.

### 4. Database Setup Strategy

#### Use CSV Import (Recommended)

Since the project already has a CSV import script, use this method for deploying to Railway PostgreSQL:

**Advantages:**
- Clean database schema creation
- Uses existing `scripts/import-products.js`
- No dependency on local database state
- Reproducible deployment
- Easier to version control data source

**Process:**
1. Railway PostgreSQL auto-creates empty database
2. Run database schema creation
3. Upload CSV file to Railway
4. Execute import script on Railway
5. Verify data imported correctly

**Steps:**

##### A. Ensure CSV File is Available

**Option 1: Commit CSV to Repository** (if not sensitive)
```bash
# Add CSV to git (if appropriate)
git add data/products.csv
git commit -m "Add product catalog data"
git push
```

**Option 2: Upload CSV via Railway CLI**
```bash
# Upload after deployment
railway run --service=<service-name> cp local-products.csv /app/data/products.csv
```

**Option 3: Download CSV in Deployment Script**
```bash
# In deployment script, download from secure location
curl -o /app/data/products.csv "$SECURE_CSV_URL"
```

##### B. Create Database Schema Script

**File:** `scripts/setup-database.js` (new file)

```javascript
const db = require('../src/config/database');

async function setupDatabase() {
    try {
        console.log('Creating database schema...');

        // Create products table
        await db.query(`
            CREATE TABLE IF NOT EXISTS products (
                id SERIAL PRIMARY KEY,
                sku VARCHAR(50) UNIQUE NOT NULL,
                name TEXT NOT NULL,
                manufacturer VARCHAR(255),
                category VARCHAR(255),
                variant_name VARCHAR(255),
                manufacturer_number VARCHAR(100),
                description TEXT,
                image_url TEXT,
                active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Create indexes
        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
            CREATE INDEX IF NOT EXISTS idx_products_manufacturer ON products(manufacturer);
            CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
            CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);
        `);

        // Create full-text search vector
        await db.query(`
            ALTER TABLE products
            ADD COLUMN IF NOT EXISTS search_vector tsvector;
        `);

        // Create full-text search index
        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_products_search
            ON products USING gin(search_vector);
        `);

        // Create trigger to update search_vector
        await db.query(`
            CREATE OR REPLACE FUNCTION products_search_trigger() RETURNS trigger AS $$
            BEGIN
                NEW.search_vector :=
                    setweight(to_tsvector('german', coalesce(NEW.name, '')), 'A') ||
                    setweight(to_tsvector('german', coalesce(NEW.manufacturer, '')), 'B') ||
                    setweight(to_tsvector('german', coalesce(NEW.category, '')), 'C') ||
                    setweight(to_tsvector('german', coalesce(NEW.sku, '')), 'D');
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;

            DROP TRIGGER IF EXISTS tsvector_update ON products;
            CREATE TRIGGER tsvector_update
                BEFORE INSERT OR UPDATE ON products
                FOR EACH ROW EXECUTE FUNCTION products_search_trigger();
        `);

        console.log('✓ Database schema created successfully');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error creating schema:', error);
        process.exit(1);
    }
}

setupDatabase();
```

##### C. Update Import Script for Railway

**File:** `scripts/import-products.js` (ensure it works with Railway)

Check that the script:
- Uses `process.env.DATABASE_URL` from Railway
- Has error handling for missing CSV
- Logs progress clearly
- Exits with proper status codes

##### D. Create Deployment Script

**File:** `scripts/deploy-railway.sh` (new file)

```bash
#!/bin/bash
# Complete Railway deployment with CSV import

set -e  # Exit on error

echo "🚀 Starting Railway deployment..."

# Step 1: Setup database schema
echo "📊 Setting up database schema..."
railway run node scripts/setup-database.js

# Step 2: Import CSV data
echo "📥 Importing product data from CSV..."
railway run node scripts/import-products.js

# Step 3: Verify import
echo "✓ Verifying data import..."
railway run node -e "
const db = require('./src/config/database');
db.query('SELECT COUNT(*) FROM products')
  .then(res => {
    console.log('Total products:', res.rows[0].count);
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
"

echo "✅ Deployment complete!"
```

Make executable:
```bash
chmod +x scripts/deploy-railway.sh
```

##### E. Add to package.json Scripts

**File:** `package.json` (modify)

```json
{
  "scripts": {
    "start": "node src/app.js",
    "setup-db": "node scripts/setup-database.js",
    "import-data": "node scripts/import-products.js",
    "deploy": "sh scripts/deploy-railway.sh"
  }
}
```

#### Alternative: SQL Dump Migration (Not Recommended)

If you absolutely need to migrate existing database:

**File:** `scripts/migrate-from-local.sh` (for reference only)

```bash
#!/bin/bash
# Export local data
pg_dump -U ids -d dental_catalog --clean --no-owner --no-acl > backup.sql

# Import to Railway
psql "$RAILWAY_DATABASE_URL" < backup.sql
```

**Why CSV Import is Better:**
- ✓ Clean slate, no legacy data issues
- ✓ Version-controlled source of truth (CSV)
- ✓ Reproducible across environments
- ✓ Easier to test and verify
- ✗ SQL dump includes potential local DB quirks

### 5. Railway Configuration Files

#### A. railway.json (Optional)

**File:** `railway.json` (new file)

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm install"
  },
  "deploy": {
    "startCommand": "node src/app.js",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 100,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

#### B. Nixpacks Configuration

**File:** `nixpacks.toml` (new file)

```toml
[phases.setup]
nixPkgs = ["nodejs-18_x"]

[phases.install]
cmds = ["npm ci"]

[phases.build]
cmds = []

[start]
cmd = "node src/app.js"
```

### 6. GitHub Actions CI/CD Pipeline (Recommended)

Set up automated testing and deployment using GitHub Actions.

**File:** `.github/workflows/deploy.yml` (new file)

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint:
    name: Lint Code
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run ESLint (if configured)
        run: npm run lint || echo "No linting configured"
        continue-on-error: true

  test:
    name: Run Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test || echo "No tests configured yet"
        continue-on-error: true

      - name: Check build
        run: node -c src/app.js

  deploy-staging:
    name: Deploy to Railway (Staging)
    needs: [lint, test]
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v3

      - name: Install Railway CLI
        run: npm install -g @railway/cli

      - name: Deploy to Staging
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN_STAGING }}
        run: |
          echo "Deploying to staging environment..."
          railway up --detach
          echo "✅ Staging deployment initiated"

  deploy-production:
    name: Deploy to Railway (Production)
    needs: [lint, test]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    environment:
      name: production
      url: https://catalog.ids.online
    steps:
      - uses: actions/checkout@v3

      - name: Install Railway CLI
        run: npm install -g @railway/cli

      - name: Deploy to Production
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
        run: |
          echo "🚀 Deploying to production..."
          railway up --detach

      - name: Wait for deployment
        run: sleep 30

      - name: Health check
        run: |
          echo "🏥 Checking application health..."
          curl --fail https://catalog.ids.online/health || exit 1
          echo "✅ Production deployment successful!"

      - name: Notify on failure
        if: failure()
        run: |
          echo "❌ Deployment failed!"
          # Add Slack/Discord notification here if needed

  setup-database:
    name: Setup Database (One-time)
    runs-on: ubuntu-latest
    if: github.event_name == 'workflow_dispatch'
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Railway CLI
        run: npm install -g @railway/cli

      - name: Setup database schema
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
        run: |
          echo "📊 Creating database schema..."
          railway run node scripts/setup-database.js

      - name: Import CSV data
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
        run: |
          echo "📥 Importing product data..."
          railway run node scripts/import-products.js

      - name: Verify import
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
        run: |
          echo "✓ Verifying data..."
          railway run node -e "require('./src/config/database').query('SELECT COUNT(*) FROM products').then(r => console.log('Products:', r.rows[0].count))"
```

#### Setup GitHub Secrets

Add these secrets to your GitHub repository:

1. Go to GitHub repo → Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Add the following secrets:

**Required Secrets:**
```
RAILWAY_TOKEN
  - Get from: railway.com → Account → Tokens
  - Description: Production Railway API token
  - Used for: Automatic deployments from main branch

RAILWAY_TOKEN_STAGING (optional)
  - Get from: Separate Railway project for staging
  - Description: Staging Railway API token
  - Used for: PR preview deployments
```

**How to get Railway token:**
```bash
# Via Railway CLI
railway login
railway whoami --token

# Or via Railway dashboard
# Go to: Account Settings → Tokens → Create New Token
```

#### Configure Railway for GitHub Integration

**Option A: Railway GitHub Integration (Easiest)**
1. Go to Railway project dashboard
2. Settings → GitHub Repo
3. Connect to `ids-showroom` repository
4. Select branch: `main`
5. Railway auto-deploys on push

**Option B: Manual CLI Deployment (CI/CD)**
- Use GitHub Actions workflow above
- Requires RAILWAY_TOKEN secret
- More control over deployment process

**Recommendation: Use Option B (GitHub Actions) for:**
- Custom health checks
- Database setup automation
- Multi-environment support (staging/production)
- Deployment notifications

#### Workflow Features

**On Pull Request:**
- ✓ Lint code
- ✓ Run tests
- ✓ Deploy to staging (optional)
- ✓ Comment PR with preview URL

**On Push to Main:**
- ✓ Lint code
- ✓ Run tests
- ✓ Deploy to production
- ✓ Run health checks
- ✓ Notify on failure

**Manual Trigger (workflow_dispatch):**
- ✓ Setup database schema
- ✓ Import CSV data
- ✓ Verify data integrity

#### Manual Database Setup Trigger

Run database setup manually via GitHub Actions:

1. Go to GitHub repo → Actions
2. Select "CI/CD Pipeline" workflow
3. Click "Run workflow" dropdown
4. Select branch: `main`
5. Click "Run workflow" button
6. Monitors progress in Actions tab

Or via Railway CLI locally:
```bash
railway login
railway run node scripts/setup-database.js
railway run node scripts/import-products.js
```

### 7. Custom Domain Setup with Cloudflare

#### A. Prerequisites
- Domain: `ids.online` (managed in Cloudflare)
- Subdomain: `catalog.ids.online`
- Cloudflare account with DNS access
- Railway app deployed and running

#### B. Get Railway Domain
1. Go to Railway project → Settings → Domains
2. Note the Railway-provided domain (e.g., `your-app.up.railway.app`)
3. Click "Custom Domain"
4. Enter: `catalog.ids.online`

#### C. Configure DNS in Cloudflare

**Login to Cloudflare:**
1. Go to https://dash.cloudflare.com
2. Select `ids.online` domain
3. Navigate to DNS → Records

**Add CNAME Record:**
```
Type: CNAME
Name: catalog
Content: your-app.up.railway.app
Proxy status: DNS only (gray cloud)
TTL: Auto
```

**Important: Use "DNS only" (gray cloud), not proxied**
- Railway needs direct DNS access for SSL provisioning
- After SSL is verified, you can enable proxy if desired

**Alternative: Use A Record (if Railway provides IP)**
```
Type: A
Name: catalog
IPv4 address: <Railway IP address>
Proxy status: DNS only
TTL: Auto
```

#### D. Verify DNS Propagation
```bash
# Check DNS propagation
dig catalog.ids.online

# Should return Railway's domain/IP
nslookup catalog.ids.online
```

**DNS propagation typically takes:**
- Cloudflare: 1-5 minutes (fast)
- Global propagation: Up to 24 hours (usually <1 hour)

#### E. Railway SSL Certificate Provisioning
1. Railway auto-detects custom domain
2. Provisions Let's Encrypt SSL certificate
3. Wait 2-10 minutes for certificate issuance
4. Railway shows "Active" status when ready

#### F. Verify HTTPS Works
```bash
# Test HTTPS connection
curl -I https://catalog.ids.online

# Should return 200 OK with HTTPS
```

#### G. Enable Cloudflare Proxy (Optional)

**After SSL is active on Railway:**
1. Go back to Cloudflare DNS settings
2. Click on `catalog` CNAME record
3. Change proxy status from "DNS only" to "Proxied" (orange cloud)
4. Save changes

**Benefits of Cloudflare Proxy:**
- Free CDN (faster global access)
- DDoS protection
- Web Application Firewall (WAF)
- Caching for static assets
- Analytics and insights
- Additional SSL/TLS options

**Cloudflare SSL/TLS Settings:**
1. Go to SSL/TLS → Overview
2. Set encryption mode: **Full (strict)**
   - Encrypts end-to-end (Cloudflare ↔ Railway)
   - Railway's SSL cert is trusted
3. Enable "Always Use HTTPS"
4. Enable "Automatic HTTPS Rewrites"

#### H. Configure Cloudflare Page Rules (Optional)

**Cache Everything Rule:**
```
URL: catalog.ids.online/style.css
Cache Level: Cache Everything
Edge Cache TTL: 1 month
```

**Force HTTPS:**
```
URL: http://catalog.ids.online/*
Always Use HTTPS: On
```

#### I. Update Environment Variables

**In Railway:**
```env
DOMAIN=https://catalog.ids.online
CANONICAL_URL=https://catalog.ids.online
```

**In Application (if needed):**
```javascript
// src/app.js
const CANONICAL_DOMAIN = process.env.CANONICAL_URL || 'http://localhost:3000';
```

#### J. Cloudflare Security Settings

**Recommended Settings:**

1. **SSL/TLS:**
   - Mode: Full (strict)
   - Minimum TLS: 1.2
   - TLS 1.3: Enabled
   - Automatic HTTPS Rewrites: On
   - Always Use HTTPS: On

2. **Firewall:**
   - Security Level: Medium
   - Bot Fight Mode: Enabled (free plan)
   - Challenge Passage: 30 minutes

3. **Speed:**
   - Auto Minify: HTML, CSS, JS (all enabled)
   - Brotli: Enabled
   - Early Hints: Enabled

4. **Caching:**
   - Caching Level: Standard
   - Browser Cache TTL: 4 hours

#### K. Testing Checklist

- [ ] `catalog.ids.online` resolves to Railway app
- [ ] HTTPS certificate is valid (no browser warnings)
- [ ] HTTP redirects to HTTPS
- [ ] All pages load correctly on custom domain
- [ ] Static assets (CSS, images) load properly
- [ ] Search functionality works
- [ ] Product detail pages accessible
- [ ] Cloudflare proxy enabled (if desired)
- [ ] SSL Labs test score A or A+ (https://ssllabs.com/ssltest/)

#### L. Troubleshooting Custom Domain

**Issue: DNS not resolving**
```bash
# Check DNS
dig catalog.ids.online

# Check from different location
nslookup catalog.ids.online 8.8.8.8
```
Solution: Wait for DNS propagation (up to 24h)

**Issue: SSL certificate error**
- Railway SSL provisioning failed
- Check Railway domain status
- Ensure DNS is "DNS only" (gray cloud) during setup
- Wait 10 minutes and retry

**Issue: Cloudflare SSL error**
- Check SSL/TLS mode is "Full (strict)"
- Verify Railway SSL is active first
- Disable Cloudflare proxy temporarily

**Issue: Mixed content warnings**
- Ensure all assets use HTTPS
- Enable "Automatic HTTPS Rewrites" in Cloudflare
- Update hardcoded HTTP URLs in code

**Issue: Redirect loop**
- Cloudflare SSL mode is "Flexible" (wrong)
- Change to "Full (strict)"
- Clear browser cache

#### M. Update Application URLs

**Update all hardcoded URLs to use custom domain:**

```javascript
// Before
const baseURL = 'http://localhost:3000';

// After
const baseURL = process.env.CANONICAL_URL || 'http://localhost:3000';
```

**Update social meta tags:**
```html
<meta property="og:url" content="https://catalog.ids.online" />
<link rel="canonical" href="https://catalog.ids.online/<%= path %>" />
```

#### N. Cloudflare Analytics

After setup, monitor:
1. Go to Cloudflare dashboard → Analytics
2. View traffic, requests, and bandwidth
3. Monitor threats blocked
4. Check cache hit ratio

---

### 8. Update Environment for Production Domain

**Railway Environment Variables:**
```env
NODE_ENV=production
PORT=3000
DATABASE_URL=${{Postgres.DATABASE_URL}}
DOMAIN=https://catalog.ids.online
CANONICAL_URL=https://catalog.ids.online
CLOUDFLARE_ENABLED=true
```

---

### 8. Post-Deployment Setup

#### A. Import Product Data to Railway Database

**Option 1: Via Railway CLI**
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link to project
railway link

# Upload CSV
railway run node scripts/import-products.js
```

**Option 2: Via Database URL**
```bash
# Get DATABASE_URL from Railway dashboard
export DATABASE_URL="postgresql://..."

# Run import locally but pointing to Railway DB
node scripts/import-products.js
```

#### B. Verify Deployment
1. Check Railway logs for errors
2. Visit health endpoint: `https://your-app.railway.app/health`
3. Test product pages: `https://your-app.railway.app/products`
4. Test search functionality
5. Monitor Railway metrics dashboard

### 9. Monitoring and Logging

**Railway provides built-in:**
- Application logs (console.log visible in dashboard)
- Resource usage metrics (CPU, memory, network)
- Deployment history
- Crash reports

**Add Structured Logging:**

**File:** `src/utils/logger.js` (new file)

```javascript
const winston = require('winston');

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.json(),
    transports: [
        new winston.transports.Console({
            format: winston.format.simple()
        })
    ]
});

module.exports = logger;
```

**Install Winston:**
```bash
npm install winston
```

---

## Cost Estimation

### Railway Pricing

**Free Tier (Hobby Plan):**
- $5/month credit (no credit card required initially)
- Good for development and small projects
- Includes PostgreSQL

**Developer Plan:**
- $20/month
- Includes $5 credit
- Usage-based pricing after credit
- Typically $10-30/month for small apps

**Estimated Cost for IDS Showroom:**
- **Development/Testing**: Free tier sufficient
- **Production (low traffic)**: ~$15-25/month
- **Production (medium traffic)**: ~$30-50/month

**Includes:**
- Node.js app hosting
- PostgreSQL database (up to 1GB)
- Automatic HTTPS
- Custom domains
- Logs and monitoring

---

## Security Considerations

### A. Environment Variables
- Never commit `.env` files
- Use Railway dashboard for secrets
- Rotate database passwords regularly

### B. Database Security
- Railway PostgreSQL includes SSL by default
- Use `rejectUnauthorized: false` for Railway SSL
- Limit database user permissions

### C. Application Security
- Helmet middleware already configured
- Add rate limiting for production
- Enable CORS if needed for API

**Add Rate Limiting:**

```bash
npm install express-rate-limit
```

**File:** `src/app.js` (modify)

```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // Limit each IP to 100 requests per windowMs
});

if (process.env.NODE_ENV === 'production') {
    app.use(limiter);
}
```

---

## Backup Strategy

### Automated Backups

**Railway PostgreSQL:**
- Automatic daily backups (on paid plans)
- Point-in-time recovery available

**Manual Backup Script:**

**File:** `scripts/backup-database.sh` (new file)

```bash
#!/bin/bash
# Backup Railway database

BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup_$TIMESTAMP.sql"

mkdir -p $BACKUP_DIR

# Get Railway database URL
RAILWAY_DB_URL=$(railway variables get DATABASE_URL)

# Create backup
pg_dump "$RAILWAY_DB_URL" > "$BACKUP_FILE"

echo "Backup created: $BACKUP_FILE"

# Optional: Upload to S3 or other storage
```

---

## Rollback Strategy

### Railway Rollback
1. Go to Deployments in Railway dashboard
2. Select previous working deployment
3. Click "Rollback"
4. Railway automatically redeploys old version

### Database Rollback
1. Use Railway backup restore feature
2. Or restore from manual backup:
```bash
psql "$RAILWAY_DATABASE_URL" < backups/backup_20241120.sql
```

---

## Performance Optimization for Production

### A. Enable Compression (Already Configured)
```javascript
app.use(compression());
```

### B. Static Asset Caching

**File:** `src/app.js` (modify)

```javascript
app.use(express.static('public', {
    maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0
}));
```

### C. Database Connection Pooling (Already Configured)
```javascript
max: 20 // Maximum pool size
```

### D. Add CDN for Static Assets (Future)
- Railway supports CDN integration
- Or use Cloudflare for free CDN

---

## Acceptance Criteria

- [ ] Application runs on Railway successfully
- [ ] PostgreSQL database hosted on Railway
- [ ] Environment variables configured securely
- [ ] Health check endpoint responds correctly
- [ ] Product data imported to Railway database
- [ ] All pages load correctly on Railway URL
- [ ] Search functionality works on production
- [ ] Product detail pages load correctly
- [ ] Images display correctly (or placeholders work)
- [ ] SSL certificate active (HTTPS)
- [ ] Custom domain `catalog.ids.online` configured in Railway
- [ ] Cloudflare DNS CNAME record created for catalog subdomain
- [ ] Cloudflare SSL mode set to "Full (strict)"
- [ ] Cloudflare proxy enabled (orange cloud) after SSL verification
- [ ] Domain resolves to Railway app via Cloudflare
- [ ] HTTPS works on custom domain without warnings
- [ ] HTTP redirects to HTTPS automatically
- [ ] Cloudflare caching and minification enabled
- [ ] SSL Labs test shows A or A+ rating
- [ ] Logs visible in Railway dashboard
- [ ] Graceful shutdown works (SIGTERM)
- [ ] Database connection pooling active
- [ ] No sensitive data in repository
- [ ] .env files in .gitignore
- [ ] Railway auto-deploys on git push
- [ ] Health check returns 200 status
- [ ] Application survives restart
- [ ] Database backup strategy in place

---

## Files to Create/Modify

### New Files
1. `.env.example` - Example environment configuration
2. `railway.json` - Railway deployment config
3. `nixpacks.toml` - Nixpacks build config (optional)
4. `src/routes/health.js` - Health check endpoint
5. `scripts/migrate-to-railway.sh` - Database migration script
6. `scripts/backup-database.sh` - Backup script
7. `.github/workflows/deploy.yml` - CI/CD pipeline (optional)

### Modified Files
1. `src/config/database.js` - Add SSL and production config
2. `src/app.js` - Add graceful shutdown, health check route
3. `.gitignore` - Add production env files
4. `README.md` - Add deployment instructions
5. `package.json` - Ensure start script exists

---

## Deployment Checklist

### Pre-Deployment
- [ ] Code committed to GitHub main branch
- [ ] `.env` files in `.gitignore`
- [ ] Database connection supports SSL
- [ ] Health check endpoint implemented
- [ ] Graceful shutdown implemented
- [ ] Error handling for missing env vars

### Railway Setup
- [ ] Railway account created
- [ ] GitHub repository connected
- [ ] PostgreSQL database added
- [ ] Environment variables configured
- [ ] Initial deployment successful

### Post-Deployment
- [ ] Import product data to Railway DB
- [ ] Test all application routes
- [ ] Verify health check responds
- [ ] Check Railway logs for errors
- [ ] Test database connectivity
- [ ] Configure custom domain (optional)
- [ ] Set up monitoring alerts
- [ ] Create backup schedule

---

## Testing Scenarios

### 1. Health Check
```bash
curl https://your-app.railway.app/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2024-11-20T...",
  "uptime": 123.45,
  "database": "connected",
  "environment": "production"
}
```

### 2. Application Routes
```bash
# Test homepage
curl -I https://your-app.railway.app/

# Test products listing
curl -I https://your-app.railway.app/products

# Test product detail
curl -I https://your-app.railway.app/product/TEST-001
```

### 3. Database Connectivity
```bash
# Via Railway CLI
railway run node -e "require('./src/config/database').query('SELECT NOW()', console.log)"
```

### 4. Static Assets
```bash
# Test CSS loads
curl -I https://your-app.railway.app/style.css

# Test images
curl -I https://your-app.railway.app/images/logo.svg
```

---

## Troubleshooting Guide

### Issue: "Cannot connect to database"
**Solution:**
- Check DATABASE_URL in Railway dashboard
- Verify SSL configuration in database.js
- Check PostgreSQL service is running

### Issue: "Application crashes on startup"
**Solution:**
- Check Railway logs for error message
- Verify all dependencies in package.json
- Check Node.js version compatibility

### Issue: "Static files not loading"
**Solution:**
- Verify public/ directory exists
- Check express.static configuration
- Ensure files committed to repository

### Issue: "Health check fails"
**Solution:**
- Check database connection
- Verify health route is mounted
- Check Railway health check timeout settings

---

## Documentation Updates Needed

### README.md
Add deployment section:
```markdown
## Deployment

This application is deployed on Railway.app.

### Production URL
https://ids-showroom.railway.app

### Deploy Your Own
1. Fork this repository
2. Sign up on Railway.app
3. Create new project from GitHub repo
4. Add PostgreSQL database
5. Import product data
6. Deploy!

See [docs/deployment.md] for detailed instructions.
```

### Create deployment.md
Detailed step-by-step deployment guide for future deployments.

---

## Future Enhancements

1. **Staging Environment**
   - Separate Railway project for staging
   - Test deployments before production

2. **Database Migrations**
   - Use knex or sequelize for schema migrations
   - Version-controlled database changes

3. **Monitoring Service**
   - Integrate with Sentry for error tracking
   - Set up uptime monitoring (UptimeRobot)

4. **Performance Monitoring**
   - Add New Relic or DataDog
   - Monitor response times and bottlenecks

5. **Blue-Green Deployments**
   - Zero-downtime deployments
   - Instant rollback capability

---

## Alternative Hosting Platforms

If Railway doesn't meet requirements:

1. **Render.com**
   - Similar to Railway
   - Free tier includes PostgreSQL
   - Slightly slower cold starts

2. **Fly.io**
   - Global edge hosting
   - More complex setup
   - Better for high-traffic apps

3. **Heroku**
   - Well-established platform
   - More expensive
   - Better documentation

4. **DigitalOcean App Platform**
   - Full control
   - More manual setup
   - $5-12/month

**Recommendation: Stick with Railway**
- Best balance of simplicity and features
- Good pricing for small/medium apps
- Excellent developer experience

---

## References

- Railway Documentation: https://docs.railway.app
- Railway CLI: https://docs.railway.app/develop/cli
- Node.js on Railway: https://docs.railway.app/guides/nodejs
- PostgreSQL on Railway: https://docs.railway.app/databases/postgresql
- Nixpacks: https://nixpacks.com/docs
