# ISSUE-011: Migrate from Sequential IDs to UUIDs

**Status**: Pending
**Date**: 2025-11-21
**Type**: Database Migration
**Component**: Database, Schema
**Assignee**: Claude Code
**Blocks**: Future API development, Public product IDs
**Priority**: Medium

---

## Objective

Migrate products table from sequential integer IDs (`id SERIAL`) to UUIDs for better security, scalability, and API design.

---

## Current State

### Products Table Schema
```sql
CREATE TABLE products (
    id SERIAL PRIMARY KEY,              -- Sequential: 1, 2, 3, 4...
    sku VARCHAR(50) UNIQUE NOT NULL,    -- Already unique: "10021"
    name TEXT NOT NULL,
    -- ... other columns
);
```

### Problems with Sequential IDs

1. **Information Disclosure**: Reveals business metrics
   - `/product/1` vs `/product/50000` exposes catalog size
   - Competitors can track growth rate
   - Leaks information about database structure

2. **Predictability**: Easy to enumerate
   - Scraping: iterate from 1 to 50000
   - No rate limiting can fully prevent enumeration
   - Security through obscurity violated

3. **Merge Conflicts**: Multiple databases
   - Cannot merge databases without ID conflicts
   - Import/export requires ID remapping
   - Distributed systems require coordination

4. **URL Aesthetics**: Not ideal for public APIs
   - `/api/products/1` looks unprofessional
   - `/api/products/a3f2b8e1-4c3d-4b5e-8f9a-1b2c3d4e5f6a` is better for APIs

---

## Proposed Solution

### Use UUIDs for Primary Keys

**Benefits:**
- **Security**: Non-sequential, impossible to guess
- **Scalability**: Globally unique, no coordination needed
- **Mergeability**: Can combine databases without conflicts
- **Professional**: Standard for modern APIs
- **Distributed**: Generate IDs in application layer

**Trade-offs:**
- **Size**: 16 bytes vs 4 bytes (4x larger)
- **Performance**: Slightly slower for indexes (marginal)
- **URLs**: Longer URLs (can use SKU instead)

---

## Implementation Plan

### Phase 1: Add UUID Column

1. **Add uuid-ossp extension**
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

2. **Add UUID column with default**
```sql
ALTER TABLE products
ADD COLUMN uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL;
```

3. **Backfill existing rows** (automatic via DEFAULT)
```sql
-- Already done by DEFAULT, but can force update:
UPDATE products SET uuid = uuid_generate_v4() WHERE uuid IS NULL;
```

4. **Create index on UUID**
```sql
CREATE INDEX idx_products_uuid ON products(uuid);
```

### Phase 2: Dual-Key Period

Run both `id` and `uuid` in parallel:
- Application continues using `id` internally
- API exposes `uuid` in responses
- Accept both `id` and `uuid` in queries

```javascript
// Accept both formats
router.get('/api/products/:identifier', async (req, res) => {
    const { identifier } = req.params;

    let query;
    if (isValidUUID(identifier)) {
        query = 'SELECT * FROM products WHERE uuid = $1';
    } else if (isNumeric(identifier)) {
        query = 'SELECT * FROM products WHERE id = $1';
    } else {
        // Try SKU
        query = 'SELECT * FROM products WHERE sku = $1';
    }

    const product = await db.query(query, [identifier]);
    res.json(product);
});
```

### Phase 3: Migrate Application Code

1. **Update models to use UUID**
```javascript
// Before
async function getProductById(id) {
    return db.query('SELECT * FROM products WHERE id = $1', [id]);
}

// After
async function getProductByUUID(uuid) {
    return db.query('SELECT * FROM products WHERE uuid = $1', [uuid]);
}
```

2. **Update foreign keys** (if any)
```sql
-- Future: orders table
ALTER TABLE orders
ADD COLUMN product_uuid UUID REFERENCES products(uuid);
```

3. **Update all queries**
```javascript
// Search for: "WHERE id =", "products.id", "SELECT id"
// Replace with: "WHERE uuid =", "products.uuid", "SELECT uuid"
```

### Phase 4: Switch Primary Key

**Warning**: This requires downtime or careful migration

1. **Create unique constraint on UUID**
```sql
ALTER TABLE products ADD CONSTRAINT products_uuid_unique UNIQUE (uuid);
```

2. **Drop old primary key**
```sql
ALTER TABLE products DROP CONSTRAINT products_pkey;
```

3. **Make UUID the primary key**
```sql
ALTER TABLE products ADD PRIMARY KEY (uuid);
```

4. **Optionally keep ID as reference**
```sql
-- Keep id column for legacy compatibility, but not PRIMARY KEY
ALTER TABLE products ALTER COLUMN id DROP DEFAULT;
-- Or drop it entirely:
-- ALTER TABLE products DROP COLUMN id;
```

---

## Alternative: Keep SKU as Primary Identifier

### Current Situation
- SKU is already UNIQUE and NOT NULL
- SKU is the natural identifier for products
- SKU appears in URLs: `/product/10021`

### Hybrid Approach

**Keep three identifiers:**
1. **SKU**: Natural key, public identifier, human-readable
2. **UUID**: Synthetic key, API identifier, non-sequential
3. **ID**: Internal key, database joins, optional

**Usage:**
- **Public URLs**: `/product/10021` (SKU)
- **API**: `{id: "a3f2b8e1-...", sku: "10021"}` (UUID + SKU)
- **Database joins**: Use `uuid` or `sku`

```sql
CREATE TABLE products (
    uuid UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    id SERIAL UNIQUE,          -- Keep for legacy, optional
    sku VARCHAR(50) UNIQUE NOT NULL,
    -- ...
);
```

---

## UUID Versions

### UUIDv4 (Random)
```sql
uuid_generate_v4() -- e.g., a3f2b8e1-4c3d-4b5e-8f9a-1b2c3d4e5f6a
```

**Pros:**
- Simple, no configuration needed
- Guaranteed unique (probability: 1 in 2^122)

**Cons:**
- No ordering (can't sort by creation time)
- Random = poor index locality

### UUIDv7 (Time-ordered, Recommended)
```sql
-- Requires extension or application-side generation
uuid_generate_v7() -- e.g., 018f-a3b2-c1d0-8f9a-1b2c3d4e5f6a
                    --        ^^ timestamp prefix
```

**Pros:**
- Time-ordered (sortable by creation time)
- Better index performance (sequential writes)
- Still globally unique

**Cons:**
- Not natively supported in PostgreSQL 14
- Requires external library or Postgres 17+

**Recommendation**: Use UUIDv7 if available (Postgres 17+), otherwise UUIDv4

---

## Migration Script

**File:** `scripts/migrate-to-uuid.js` (new file)

```javascript
const db = require('../src/config/database');

async function migrateToUUID() {
    const client = await db.connect();

    try {
        await client.query('BEGIN');

        console.log('1. Installing uuid-ossp extension...');
        await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

        console.log('2. Adding UUID column...');
        await client.query(`
            ALTER TABLE products
            ADD COLUMN IF NOT EXISTS uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL
        `);

        console.log('3. Creating UUID index...');
        await client.query('CREATE INDEX IF NOT EXISTS idx_products_uuid ON products(uuid)');

        console.log('4. Backfilling UUIDs for existing rows...');
        const result = await client.query(`
            UPDATE products
            SET uuid = uuid_generate_v4()
            WHERE uuid IS NULL
        `);
        console.log(`   Updated ${result.rowCount} rows`);

        await client.query('COMMIT');
        console.log('✓ Migration complete!');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('✗ Migration failed:', error);
        throw error;
    } finally {
        client.release();
    }
}

migrateToUUID()
    .then(() => process.exit(0))
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
```

**Usage:**
```bash
node scripts/migrate-to-uuid.js
```

---

## API Response Format

### Before (Sequential ID)
```json
{
  "id": 1,
  "sku": "10021",
  "name": "Dental Mirror"
}
```

### After (UUID Primary, ID Secondary)
```json
{
  "uuid": "018f-a3b2-c1d0-8f9a-1b2c3d4e5f6a",
  "id": 1,
  "sku": "10021",
  "name": "Dental Mirror"
}
```

### Future (UUID Only)
```json
{
  "id": "018f-a3b2-c1d0-8f9a-1b2c3d4e5f6a",
  "sku": "10021",
  "name": "Dental Mirror"
}
```

---

## URL Strategy

### Option 1: UUIDs in URLs
```
GET /api/products/018f-a3b2-c1d0-8f9a-1b2c3d4e5f6a
```

**Pros**: Consistent with database
**Cons**: Long, not user-friendly

### Option 2: SKU in URLs (Recommended)
```
GET /api/products/10021
GET /product/10021
```

**Pros**: Short, human-readable, SEO-friendly
**Cons**: SKU could theoretically change (rare)

### Option 3: Hybrid
```
GET /api/products/10021              # SKU lookup
GET /api/products/uuid/018f-a3b2-... # UUID lookup
```

---

## Performance Considerations

### Index Size
- **Integer PK**: 4 bytes per row + index overhead
- **UUID PK**: 16 bytes per row + index overhead
- **Impact**: ~12 bytes × 50K products = 600 KB additional

### Query Performance
- **Integer**: Optimal for range queries
- **UUID**: Optimal for exact matches
- **UUIDv7**: Good for range queries (time-ordered)

### Insert Performance
- **Integer**: Sequential writes (optimal)
- **UUIDv4**: Random writes (slower, index fragmentation)
- **UUIDv7**: Sequential writes (optimal)

**Recommendation**: Use UUIDv7 if possible, or keep integer ID for internal use

---

## Rollback Plan

If migration fails or causes issues:

```sql
-- Remove UUID column
ALTER TABLE products DROP COLUMN uuid;

-- Remove extension
DROP EXTENSION "uuid-ossp";
```

---

## Testing Checklist

- [ ] Install uuid-ossp extension
- [ ] Add UUID column with default
- [ ] Create UUID index
- [ ] Backfill UUIDs for existing products
- [ ] Update application code to accept UUIDs
- [ ] Test API endpoints with UUIDs
- [ ] Test performance (queries, inserts, index size)
- [ ] Verify uniqueness constraints
- [ ] Update documentation
- [ ] Plan primary key migration (if desired)

---

## Acceptance Criteria

- [ ] `uuid-ossp` extension installed
- [ ] `uuid` column added to products table
- [ ] All existing products have UUIDs
- [ ] UUID index created
- [ ] Application code supports UUID lookups
- [ ] API responses include UUID field
- [ ] Documentation updated
- [ ] Performance impact measured and acceptable
- [ ] Rollback procedure tested
- [ ] Migration script committed to repository

---

## Timeline

### Phase 1: Add UUID (1-2 hours)
- Install extension
- Add column and index
- Backfill data
- Test

### Phase 2: Update Application (2-4 hours)
- Update models
- Update controllers
- Update views
- Test

### Phase 3: Switch Primary Key (Optional, 1-2 hours)
- Drop old PK
- Add new PK
- Update foreign keys
- Test

**Total**: 4-8 hours

---

## Future Considerations

### Foreign Keys
When other tables reference products:
```sql
-- Future: orders table
CREATE TABLE orders (
    uuid UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_uuid UUID REFERENCES products(uuid),
    -- ...
);
```

### Import/Export
UUIDs make data portable:
```json
{
  "uuid": "018f-a3b2-c1d0-8f9a-1b2c3d4e5f6a",
  "sku": "10021",
  "name": "Dental Mirror"
}
```

Can import into any database without ID conflicts!

---

## References

- [PostgreSQL UUID Type](https://www.postgresql.org/docs/current/datatype-uuid.html)
- [uuid-ossp Extension](https://www.postgresql.org/docs/current/uuid-ossp.html)
- [UUIDv7 Specification](https://www.ietf.org/archive/id/draft-peabody-dispatch-new-uuid-format-04.html)
- [Primary Keys: IDs vs UUIDs](https://tomharrisonjr.com/uuid-or-guid-as-primary-keys-be-careful-7b2aa3dcb439)
