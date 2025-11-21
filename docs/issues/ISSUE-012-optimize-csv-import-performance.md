# ISSUE-012: Optimize CSV Import Performance

**Status**: Pending
**Date**: 2025-11-21
**Type**: Performance Optimization
**Component**: Scripts, Database
**Assignee**: Claude Code
**Priority**: High

---

## Objective

Optimize CSV import performance on Railway from ~1s/product (11+ hours for 41K products) to <100ms/product (<70 minutes total) by implementing batch inserts and transaction optimization.

---

## Current Performance

### Local Performance
- **Speed**: Milliseconds per product
- **Reason**: Low network latency, fast local PostgreSQL

### Railway Performance
- **Speed**: ~1 second per product
- **Total Time**: 41,000 products × 1s = 11+ hours
- **Bottleneck**: Network round trips and individual transactions

### Root Causes

1. **Individual INSERTs**: One database query per product (41,000 queries)
2. **Network Latency**: Each query goes through Railway's proxy (~50-100ms latency)
3. **Auto-commit**: Each INSERT is a separate transaction
4. **Trigger Overhead**: `products_search_trigger()` runs 41,000 times
5. **No Connection Pooling**: Script creates connection per query

---

## Proposed Solution

### 1. Batch Inserts (Primary Optimization)

Instead of:
```javascript
// 41,000 individual queries
for (const product of products) {
    await db.query('INSERT INTO products (...) VALUES ($1, $2, ...)', [values]);
}
```

Use:
```javascript
// 410 queries (100 products per batch)
const BATCH_SIZE = 100;
for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE);

    // Build multi-row INSERT
    const values = [];
    const placeholders = [];

    batch.forEach((product, idx) => {
        const offset = idx * 9; // 9 columns
        placeholders.push(`($${offset+1}, $${offset+2}, $${offset+3}, ...)`);
        values.push(...product.toArray());
    });

    await db.query(`
        INSERT INTO products (sku, name, variant_name, ...)
        VALUES ${placeholders.join(', ')}
        ON CONFLICT (sku) DO UPDATE SET ...
    `, values);
}
```

**Expected Improvement**: 100x fewer network round trips = ~100x faster

### 2. Transaction Batching

Wrap batches in explicit transactions:
```javascript
await client.query('BEGIN');
try {
    // Insert 1000 products
    await client.query('INSERT INTO products ...');
    await client.query('COMMIT');
} catch (error) {
    await client.query('ROLLBACK');
    throw error;
}
```

**Expected Improvement**: 10-20% faster by reducing commit overhead

### 3. Disable/Defer Triggers During Import

```javascript
// Before import
await db.query('ALTER TABLE products DISABLE TRIGGER tsvector_update');

// Do import
await importAllProducts();

// After import - rebuild search vectors in one go
await db.query('ALTER TABLE products ENABLE TRIGGER tsvector_update');
await db.query(`
    UPDATE products SET search_vector =
        setweight(to_tsvector('german', coalesce(name, '')), 'A') ||
        setweight(to_tsvector('german', coalesce(manufacturer, '')), 'B') ||
        setweight(to_tsvector('german', coalesce(category, '')), 'C') ||
        setweight(to_tsvector('german', coalesce(sku, '')), 'D')
    WHERE search_vector IS NULL
`);
```

**Expected Improvement**: 20-30% faster by deferring search vector updates

### 4. Use PostgreSQL COPY Command (Alternative)

For the absolute fastest import:
```javascript
const { from } = require('pg-copy-streams');
const copyStream = client.query(from(`
    COPY products (sku, name, variant_name, ...)
    FROM STDIN WITH (FORMAT csv, HEADER true)
`));

fs.createReadStream('products.csv').pipe(copyStream);
```

**Expected Improvement**: 10-100x faster than individual INSERTs
**Trade-off**: No UPSERT support, requires pre-processing for updates

---

## Implementation Plan

### Option A: Batch INSERT (Recommended)

**Pros:**
- Maintains UPSERT logic
- Significant performance gain
- Simple to implement
- Works with existing sanitization

**Cons:**
- Need to construct dynamic SQL
- More complex error handling

### Option B: COPY Command

**Pros:**
- Maximum performance
- Native PostgreSQL optimization

**Cons:**
- No UPSERT (need to DELETE first)
- Requires pre-processing CSV
- Less flexible

**Recommendation**: Use **Option A (Batch INSERT)** for initial optimization, consider Option B later if needed.

---

## Implementation Details

### Batch Insert with UPSERT

**File:** `scripts/import-csv.js` (modify)

```javascript
const BATCH_SIZE = 100; // Tune based on performance testing

async function importCSV(filepath) {
    const client = await db.connect();

    try {
        const records = parseCSV(filepath);
        const batches = [];

        // Group records into batches
        for (let i = 0; i < records.length; i += BATCH_SIZE) {
            batches.push(records.slice(i, i + BATCH_SIZE));
        }

        console.log(`Processing ${batches.length} batches of ~${BATCH_SIZE} products each`);

        for (const [batchIdx, batch] of batches.entries()) {
            await client.query('BEGIN');

            try {
                await insertBatch(client, batch);
                await client.query('COMMIT');

                const processed = (batchIdx + 1) * BATCH_SIZE;
                console.log(`  Processed ${Math.min(processed, records.length)}/${records.length} products...`);
            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`Batch ${batchIdx} failed:`, error.message);
                // Continue with next batch or throw
            }
        }
    } finally {
        client.release();
    }
}

async function insertBatch(client, products) {
    const columns = ['sku', 'name', 'variant_name', 'manufacturer',
                     'manufacturer_number', 'product_group', 'description',
                     'image_url', 'category'];

    const values = [];
    const placeholders = [];

    products.forEach((product, idx) => {
        const offset = idx * columns.length;
        const productPlaceholders = columns.map((_, i) => `$${offset + i + 1}`);
        placeholders.push(`(${productPlaceholders.join(', ')})`);

        // Add product values
        values.push(
            product.sku,
            product.name,
            product.variantName,
            product.manufacturer,
            product.manufacturerNumber,
            product.productGroup,
            product.description,
            product.imageUrl,
            product.category
        );
    });

    await client.query(`
        INSERT INTO products (${columns.join(', ')})
        VALUES ${placeholders.join(', ')}
        ON CONFLICT (sku) DO UPDATE SET
            name = EXCLUDED.name,
            variant_name = EXCLUDED.variant_name,
            manufacturer = EXCLUDED.manufacturer,
            manufacturer_number = EXCLUDED.manufacturer_number,
            product_group = EXCLUDED.product_group,
            description = EXCLUDED.description,
            image_url = EXCLUDED.image_url,
            category = EXCLUDED.category,
            updated_at = NOW()
    `, values);
}
```

### Disable Triggers During Import

```javascript
// Add flag to import function
async function importCSV(filepath, options = {}) {
    const { disableTriggers = true } = options;

    if (disableTriggers) {
        await db.query('ALTER TABLE products DISABLE TRIGGER tsvector_update');
        console.log('⚡ Disabled search triggers for faster import');
    }

    try {
        // Do import...
    } finally {
        if (disableTriggers) {
            await db.query('ALTER TABLE products ENABLE TRIGGER tsvector_update');
            await db.query(`
                UPDATE products
                SET search_vector =
                    setweight(to_tsvector('german', coalesce(name, '')), 'A') ||
                    setweight(to_tsvector('german', coalesce(manufacturer, '')), 'B') ||
                    setweight(to_tsvector('german', coalesce(category, '')), 'C') ||
                    setweight(to_tsvector('german', coalesce(sku, '')), 'D')
                WHERE search_vector IS NULL OR updated_at > NOW() - INTERVAL '1 minute'
            `);
            console.log('✓ Re-enabled search triggers and updated vectors');
        }
    }
}
```

---

## Performance Comparison

### Current Performance
```
41,000 products × 1000ms = 41,000 seconds = 11.4 hours
```

### With Batch INSERT (100 per batch)
```
410 batches × 100ms = 41 seconds = <1 minute
Expected: 50-100x improvement
```

### With Batch INSERT + Disabled Triggers
```
410 batches × 70ms = 29 seconds
Expected: 70-100x improvement
```

### With COPY Command
```
41,000 products × 0.5ms = 20 seconds
Expected: 100x+ improvement
```

---

## Testing Plan

### 1. Test with Small Batch
```bash
# Test with 1000 products
head -1001 data/2025_06_04_scraping_products.csv > data/test-1000.csv
time npm run import data/test-1000.csv
```

### 2. Test Different Batch Sizes
```javascript
// Try: 50, 100, 200, 500, 1000
const BATCH_SIZE = process.env.BATCH_SIZE || 100;
```

### 3. Measure Improvement
```bash
# Before: Individual inserts
time npm run import data/test-1000.csv

# After: Batch inserts
time npm run import data/test-1000.csv
```

---

## Acceptance Criteria

- [ ] Batch INSERT implementation with configurable batch size
- [ ] UPSERT logic preserved for batch inserts
- [ ] Transaction batching implemented
- [ ] Optional trigger disabling during import
- [ ] Import time reduced from 11+ hours to <1 hour on Railway
- [ ] Batch size configurable via environment variable
- [ ] Error handling per batch (one batch failure doesn't stop entire import)
- [ ] Progress reporting (batches completed)
- [ ] Import history logs batch statistics
- [ ] Documentation updated with performance notes

---

## Environment Variables

```env
# Batch size for CSV imports (default: 100)
CSV_BATCH_SIZE=100

# Disable triggers during import for better performance (default: true)
CSV_DISABLE_TRIGGERS=true

# Transaction batch size (default: 1000)
CSV_TRANSACTION_SIZE=1000
```

---

## Railway Considerations

### Network Latency
- Railway proxy adds ~50-100ms per query
- Batch inserts reduce number of queries by 100x
- Critical for production imports

### Memory Constraints
- Batch size should not exceed memory limits
- Railway: 512MB-8GB depending on plan
- Recommended: 100-500 products per batch

### Timeout Limits
- Railway: 10-minute timeout for commands
- With batching: 41K products in <5 minutes
- Well within timeout limits

---

## Rollout Plan

### Phase 1: Implement Batch INSERT
1. Create new `import-csv-batched.js`
2. Test with sample data
3. Compare performance
4. Replace existing import script

### Phase 2: Add Trigger Optimization
1. Add disable/enable trigger logic
2. Test search functionality after import
3. Measure additional improvement

### Phase 3: Production Deployment
1. Update GitHub Actions workflow
2. Run full import on Railway
3. Monitor performance
4. Document final timings

---

## References

- [PostgreSQL Bulk Insert Performance](https://www.postgresql.org/docs/current/populate.html)
- [pg-copy-streams](https://github.com/brianc/node-pg-copy-streams)
- [PostgreSQL Performance Tips](https://wiki.postgresql.org/wiki/Performance_Optimization)
- [Railway Pricing & Limits](https://docs.railway.app/reference/pricing)
