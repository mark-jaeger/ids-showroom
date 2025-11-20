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
 * Import products from CSV
 * Deduplicates on SKU (upsert)
 */
async function importCSV(filepath) {
    console.log(`\n============================================================`);
    console.log(`Starting CSV Import`);
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

    console.log(`Found ${records.length} rows in CSV\n`);

    const results = {
        success: 0,
        failed: 0,
        errors: []
    };

    // Track seen SKUs to dedupe within CSV
    const seenSkus = new Set();

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
                console.log(`  ⚠ Duplicate SKU in CSV, skipping: ${sku}`);
                continue;
            }
            seenSkus.add(sku);

            // Extract and clean data
            const variantName = cleanValue(row.variant_name);
            const manufacturer = row.manufacturer ? row.manufacturer.trim() : 'Unknown';
            const manufacturerNumber = cleanValue(row.manufacturer_number);
            const productGroup = cleanValue(row.product_group);
            const description = sanitizeDescription(row.produktbeschreibung);
            const imageUrl = cleanValue(row.image_url);
            const category = getLeafCategory(row);

            // Upsert product (insert or update if SKU exists)
            await db.query(`
                INSERT INTO products (
                    sku, name, variant_name, manufacturer, manufacturer_number,
                    product_group, description, image_url, category
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT (sku)
                DO UPDATE SET
                    name = EXCLUDED.name,
                    variant_name = EXCLUDED.variant_name,
                    manufacturer = EXCLUDED.manufacturer,
                    manufacturer_number = EXCLUDED.manufacturer_number,
                    product_group = EXCLUDED.product_group,
                    description = EXCLUDED.description,
                    image_url = EXCLUDED.image_url,
                    category = EXCLUDED.category,
                    updated_at = NOW()
            `, [
                sku, name, variantName, manufacturer, manufacturerNumber,
                productGroup, description, imageUrl, category
            ]);

            results.success++;

            if (results.success % 100 === 0) {
                console.log(`  Processed ${results.success} products...`);
            }
        } catch (error) {
            results.failed++;
            results.errors.push({
                row: i + 2,  // +2 because: 1 for header, 1 for 0-index
                sku: row.artikelnummer || 'unknown',
                error: error.message
            });
        }
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
