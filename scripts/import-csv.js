const fs = require('fs');
const { parse } = require('csv-parse/sync');
const sanitizeHtml = require('sanitize-html');
require('dotenv').config();
const db = require('../src/config/database');

/**
 * Sanitize HTML description
 * Allow safe tags: p, ul, li, b, strong, i, em, h3
 * Strip all others including scripts, styles
 */
function sanitizeDescription(html) {
    if (!html || html === 'nan' || html.trim() === '') {
        return null;
    }

    return sanitizeHtml(html, {
        allowedTags: ['p', 'ul', 'li', 'b', 'strong', 'i', 'em', 'h3'],
        allowedAttributes: {},
        disallowedTagsMode: 'discard'
    });
}

/**
 * Extract leaf category from cat1/cat2/cat3/cat4
 * Returns the deepest non-null category
 */
function getLeafCategory(row) {
    if (row.cat4 && row.cat4 !== 'nan' && row.cat4.trim() !== '') return row.cat4.trim();
    if (row.cat3 && row.cat3 !== 'nan' && row.cat3.trim() !== '') return row.cat3.trim();
    if (row.cat2 && row.cat2 !== 'nan' && row.cat2.trim() !== '') return row.cat2.trim();
    if (row.cat1 && row.cat1 !== 'nan' && row.cat1.trim() !== '') return row.cat1.trim();
    return null;
}

/**
 * Clean value - convert "nan", empty strings, and null-ish values to null
 */
function cleanValue(value) {
    if (!value || value === 'nan' || value.trim() === '') {
        return null;
    }
    return value.trim();
}

/**
 * Insert a batch of products using multi-row INSERT
 * @param {Object} client - PostgreSQL client from pool
 * @param {Array} products - Array of product objects to insert
 */
async function insertBatch(client, products) {
    if (products.length === 0) return;

    const columns = ['sku', 'name', 'variant_name', 'manufacturer', 'manufacturer_number',
                     'product_group', 'description', 'image_url', 'category'];

    const values = [];
    const placeholders = [];

    products.forEach((product, idx) => {
        const offset = idx * columns.length;
        const productPlaceholders = columns.map((_, i) => `$${offset + i + 1}`);
        placeholders.push(`(${productPlaceholders.join(', ')})`);

        // Add all product values in order
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

/**
 * Import products from CSV with batch processing
 * Deduplicates on SKU (upsert)
 */
async function importCSV(filepath) {
    console.log(`\n============================================================`);
    console.log(`Starting CSV Import (Batch Mode)`);
    console.log(`============================================================`);
    console.log(`File: ${filepath}`);

    // Check if file exists
    if (!fs.existsSync(filepath)) {
        throw new Error(`File not found: ${filepath}`);
    }

    const content = fs.readFileSync(filepath, 'utf-8');
    const records = parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true  // Handle Excel UTF-8 BOM
    });

    console.log(`Found ${records.length} rows in CSV`);

    // Configurable batch size (default: 100, can be overridden via env var)
    const BATCH_SIZE = parseInt(process.env.CSV_BATCH_SIZE || '100');
    console.log(`Batch size: ${BATCH_SIZE} products per batch\n`);

    const results = {
        success: 0,
        failed: 0,
        errors: []
    };

    // Track seen SKUs to dedupe within CSV
    const seenSkus = new Set();

    // Collect valid products for batch processing
    const products = [];

    for (let i = 0; i < records.length; i++) {
        const row = records[i];

        try {
            // Validate required fields
            if (!row.artikelnummer || !row.produktname) {
                throw new Error('Missing required fields: artikelnummer or produktname');
            }

            const sku = row.artikelnummer.trim();
            const name = row.produktname.trim();

            // Skip duplicates within CSV (keep last occurrence)
            if (seenSkus.has(sku)) {
                continue;
            }
            seenSkus.add(sku);

            // Extract and clean data
            const product = {
                sku,
                name,
                variantName: cleanValue(row.variant_name),
                manufacturer: row.manufacturer ? row.manufacturer.trim() : 'Unknown',
                manufacturerNumber: cleanValue(row.manufacturer_number),
                productGroup: cleanValue(row.product_group),
                description: sanitizeDescription(row.produktbeschreibung),
                imageUrl: cleanValue(row.image_url),
                category: getLeafCategory(row)
            };

            products.push(product);
        } catch (error) {
            results.failed++;
            results.errors.push({
                row: i + 2,  // +2 because: 1 for header, 1 for 0-index
                sku: row.artikelnummer || 'unknown',
                error: error.message
            });
        }
    }

    console.log(`Valid products: ${products.length}`);
    console.log(`Skipped/Invalid: ${results.failed}\n`);

    // Process in batches with transactions
    const client = await db.connect();

    try {
        const totalBatches = Math.ceil(products.length / BATCH_SIZE);
        console.log(`Processing ${totalBatches} batches...\n`);

        for (let i = 0; i < products.length; i += BATCH_SIZE) {
            const batch = products.slice(i, i + BATCH_SIZE);
            const batchNum = Math.floor(i / BATCH_SIZE) + 1;

            try {
                // Begin transaction for this batch
                await client.query('BEGIN');

                // Insert batch
                await insertBatch(client, batch);

                // Commit transaction
                await client.query('COMMIT');

                results.success += batch.length;

                console.log(`  ✓ Batch ${batchNum}/${totalBatches}: ${batch.length} products (Total: ${results.success}/${products.length})`);
            } catch (error) {
                // Rollback on error
                await client.query('ROLLBACK');

                console.error(`  ✗ Batch ${batchNum} failed: ${error.message}`);

                // Record batch failure
                results.failed += batch.length;
                results.errors.push({
                    batch: batchNum,
                    size: batch.length,
                    error: error.message
                });
            }
        }
    } finally {
        client.release();
    }

    // Log import history
    await db.query(`
        INSERT INTO import_history (filename, rows_imported, rows_failed, errors)
        VALUES ($1, $2, $3, $4)
    `, [filepath, results.success, results.failed, JSON.stringify(results.errors)]);

    return results;
}

// CLI execution
const filepath = process.argv[2];

if (!filepath) {
    console.error('\n❌ Error: No file specified');
    console.error('\nUsage: npm run import <path-to-csv>');
    console.error('Example: npm run import data/sample.csv\n');
    process.exit(1);
}

importCSV(filepath)
    .then(results => {
        console.log(`\n============================================================`);
        console.log(`✓ Import Complete`);
        console.log(`============================================================`);
        console.log(`Success: ${results.success}`);
        console.log(`Failed: ${results.failed}`);

        if (results.errors.length > 0) {
            console.log(`\nErrors:`);
            results.errors.slice(0, 10).forEach(e => {
                console.log(`  • Row ${e.row} (SKU: ${e.sku}): ${e.error}`);
            });
            if (results.errors.length > 10) {
                console.log(`  ... and ${results.errors.length - 10} more`);
            }
        }

        console.log(`============================================================\n`);
        process.exit(0);
    })
    .catch(error => {
        console.error('\n============================================================');
        console.error('✗ Import Failed');
        console.error('============================================================');
        console.error(error.message);
        console.error('============================================================\n');
        process.exit(1);
    });
