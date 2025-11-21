# ADR-003: Railway Deployment Architecture

**Date**: 2025-11-21
**Status**: Accepted
**Deciders**: Mark Jaeger, Claude Code
**Context**: ISSUE-009 Railway Deployment

---

## Context

After completing the application with product listing, search, and filtering (ISSUE-001 through ISSUE-005), we needed to deploy the application to a production environment accessible via custom domain (catalog.ids.online).

---

## Decision

Deploy the application using Railway.app with the following architecture:

### Infrastructure
- **Application Hosting**: Railway (Node.js/Express)
- **Database**: PostgreSQL on Railway (separate project)
- **CDN/Security**: Cloudflare (proxy mode)
- **CI/CD**: GitHub Actions with Railway CLI

### Configuration
- Separate Railway projects for app and database (isolation)
- Public database URL for cross-project access
- Environment variables managed in Railway dashboard
- Custom domain via Cloudflare CNAME

---

## Rationale

### Why Railway?
1. **Simplicity**: Zero-config Node.js and PostgreSQL hosting
2. **Free Tier**: Sufficient for MVP with 29K products
3. **Auto-scaling**: Built-in as traffic grows
4. **GitHub Integration**: Auto-deploy on push
5. **Reliability**: Health checks and automatic restarts

### Why Cloudflare?
1. **DDoS Protection**: Critical for public-facing app
2. **SSL/TLS**: Automatic HTTPS
3. **Caching**: Improved performance
4. **Analytics**: Traffic insights

### Why Separate Projects?
1. **Isolation**: Database independent of app deployments
2. **Billing**: Separate cost tracking
3. **Access Control**: Fine-grained permissions
4. **Flexibility**: Can swap out app or database independently

---

## Consequences

### Positive
- ✅ Simple deployment process
- ✅ Automatic HTTPS and scaling
- ✅ Low operational overhead
- ✅ Cost-effective for MVP
- ✅ Good developer experience

### Negative
- ⚠️ Vendor lock-in (mitigated by standard Node.js/PostgreSQL)
- ⚠️ Network latency for database access (acceptable for our use case)
- ⚠️ Requires Railway CLI for deployments

### Neutral
- Multi-service setup requires service ID specification
- Environment variables must be managed in two places (GitHub + Railway)

---

## Implementation Details

See `current-session.md` for full deployment timeline and resolved issues.

**Key Configuration**:
- App binds to `0.0.0.0` (Railway requirement)
- Database connection non-blocking (prevents startup failures)
- Health check timeout: 100s
- DNS: catalog.ids.online → rnipj0zu.up.railway.app

**Critical Fixes**:
1. App binding issue (commit: 5a32737)
2. Database environment variable (manual configuration)
3. Service identification (commit: af99df4)
4. DNS configuration (commit: b335ad2)

---

## Alternatives Considered

### 1. Heroku
- **Pros**: Mature, well-documented
- **Cons**: More expensive, less modern DX
- **Decision**: Railway chosen for better free tier and simpler setup

### 2. DigitalOcean App Platform
- **Pros**: More control, good pricing
- **Cons**: More configuration required
- **Decision**: Railway chosen for faster MVP delivery

### 3. Self-hosted (VPS)
- **Pros**: Maximum control, lowest cost at scale
- **Cons**: High maintenance, no auto-scaling
- **Decision**: Railway chosen for lower operational burden

### 4. Vercel/Netlify
- **Pros**: Excellent for static/JAM stack
- **Cons**: PostgreSQL requires external service
- **Decision**: Railway chosen for integrated database

---

## Monitoring

- Railway Dashboard: Deployment logs, metrics
- Cloudflare Analytics: Traffic, security events
- GitHub Actions: CI/CD status
- Custom: `/health` endpoint monitoring

---

## Future Considerations

1. **Staging Environment**: Consider separate Railway project
2. **Database Backups**: Implement automated backup strategy
3. **Performance Monitoring**: Add APM (Sentry, New Relic)
4. **Cost Optimization**: Monitor usage, optimize queries
5. **Migration Path**: Document process to move off Railway if needed

---

**Status**: ✅ Successfully implemented
**Production URL**: https://catalog.ids.online
**Deployment Date**: 2025-11-21
