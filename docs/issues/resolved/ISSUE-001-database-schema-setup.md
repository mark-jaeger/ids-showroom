# ISSUE-001: Database Schema Setup

**Status**: ✅ RESOLVED
**Date**: 2024-11-20
**Type**: Feature - Phase 1
**Component**: Database
**Assignee**: Claude Code

---

## Objective

Set up the PostgreSQL database schema with tables, indexes, and seed data for the dental product catalog MVP.

---

## Scope

This is Phase 1 of the incremental implementation approach. It establishes the database foundation before building the application layer.

**Deliverables:**
1. PostgreSQL schema script (`scripts/schema.sql`)
2. Database configuration module (`src/config/database.js`)
3. Seed data for development/testing
4. Environment configuration (`.env.example`)
5. Verification that database is functional

---

## Database Components

### Tables to Create

1. **products** - Main product catalog table
   - Fields: id, sku, name, variant_name, manufacturer, manufacturer_number, product_group, description, image_url, category, active, timestamps
   - Full-text search vector (German language)
   - Generated column for tsvector

2. **import_history** - Track CSV imports
   - Fields: id, filename, rows_imported, rows_failed, errors (JSONB), imported_at

### Extensions Required

- `pg_trgm` - Trigram matching for fuzzy search
- `unaccent` - Accent-insensitive search

### Indexes to Create

- GIN index on search_vector for full-text search
- B-tree indexes on manufacturer, category, sku
- Partial index on active products

---

## Implementation Plan

### 1. Project Structure Setup

```
/Users/mark/Repositories/ids-showroom/
├── scripts/
│   └── schema.sql          # Database schema
├── src/
│   └── config/
│       └── database.js     # PostgreSQL connection pool
├── .env.example            # Environment template
├── .env                    # Local environment (gitignored)
├── .gitignore
└── package.json
```

### 2. Dependencies

Add to package.json:
- `pg` - PostgreSQL client
- `dotenv` - Environment variable management

### 3. Schema Design

Follow specification in `docs/implementation specification.md`:
- German full-text search configuration
- Weighted search ranking (name > manufacturer > sku > description)
- HTML sanitization consideration for description field
- UPSERT support via unique constraint on SKU

### 4. Seed Data

Insert 3-5 test products covering:
- Different manufacturers
- Different categories
- Mix of products with/without images
- Mix of products with/without variant names
- German product names for search testing

### 5. Connection Configuration

- Use connection pooling (max 20 connections)
- Set appropriate timeouts
- Support DATABASE_URL environment variable format
- Handle connection errors gracefully

---

## Acceptance Criteria

- [ ] `scripts/schema.sql` creates all tables, extensions, and indexes without errors
- [ ] `src/config/database.js` successfully connects to PostgreSQL
- [ ] Extensions (pg_trgm, unaccent) are installed
- [ ] Products table has search_vector generated column working
- [ ] Seed data is inserted (3-5 test products)
- [ ] Can query products and search works
- [ ] `.env.example` documents required environment variables
- [ ] `.gitignore` excludes `.env` file

---

## Testing Steps

After implementation:

```bash
# 1. Create local database
createdb dental_catalog

# 2. Run schema
psql dental_catalog -f scripts/schema.sql

# 3. Verify tables exist
psql dental_catalog -c "\dt"

# 4. Verify extensions
psql dental_catalog -c "\dx"

# 5. Verify seed data
psql dental_catalog -c "SELECT sku, name, manufacturer FROM products;"

# 6. Test search vector
psql dental_catalog -c "SELECT name FROM products WHERE search_vector @@ plainto_tsquery('german', 'dental');"

# 7. Test Node.js connection
node -e "require('dotenv').config(); const db = require('./src/config/database'); db.query('SELECT COUNT(*) FROM products').then(r => { console.log('Products:', r.rows[0].count); process.exit(0); }).catch(e => { console.error(e); process.exit(1); });"
```

---

## Files to Create

1. `/scripts/schema.sql` - Complete database schema
2. `/src/config/database.js` - Database connection pool
3. `/.env.example` - Environment variable template
4. `/.gitignore` - Git ignore rules
5. `/package.json` - Project dependencies (initial)

---

## Notes

- Database schema follows specification in `docs/implementation specification.md` lines 28-95
- Using German language configuration for full-text search
- SKU is unique constraint to support CSV upserts later
- Search vector is GENERATED ALWAYS for automatic updates
- Consider using https://placehold.co for placeholder images in seed data

---

## Next Steps (Future Issues)

After this issue is resolved:
- ISSUE-002: Basic Express app setup + /products route
- ISSUE-003: Product model with search queries
- ISSUE-004: EJS views and templating
- ISSUE-005: Search and filtering functionality

---

## References

- Implementation spec: `docs/implementation specification.md`
- PostgreSQL full-text search: https://www.postgresql.org/docs/current/textsearch.html
- pg module docs: https://node-postgres.com/
