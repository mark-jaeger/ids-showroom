const db = require('../config/database');

/**
 * Search products with optional filters
 * @param {string} query - Full-text search query
 * @param {string} manufacturer - Filter by manufacturer name
 * @param {string} category - Filter by category name
 * @param {number} page - Page number (1-indexed)
 * @param {number} limit - Products per page
 * @returns {Object} { products: Array, totalCount: number }
 */
async function searchProducts({
    query = '',
    manufacturer = null,
    category = null,
    page = 1,
    limit = 48
}) {
    let sql = `
        SELECT *
        FROM products
        WHERE active = true
    `;

    const params = [];
    let paramIndex = 1;

    // Full-text search
    if (query && query.trim() !== '') {
        sql += ` AND search_vector @@ plainto_tsquery('german', $${paramIndex})`;
        params.push(query.trim());
        paramIndex++;
    }

    // Manufacturer filter
    if (manufacturer) {
        sql += ` AND manufacturer = $${paramIndex}`;
        params.push(manufacturer);
        paramIndex++;
    }

    // Category filter
    if (category) {
        sql += ` AND category = $${paramIndex}`;
        params.push(category);
        paramIndex++;
    }

    // Order by relevance or name
    if (query && query.trim() !== '') {
        sql += ` ORDER BY ts_rank(search_vector, plainto_tsquery('german', $1)) DESC`;
    } else {
        sql += ` ORDER BY name ASC`;
    }

    // Pagination
    const offset = (page - 1) * limit;
    sql += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await db.query(sql, params);

    // Get total count for pagination
    let countSql = 'SELECT COUNT(*) FROM products WHERE active = true';
    const countParams = [];
    let countParamIndex = 1;

    if (query && query.trim() !== '') {
        countSql += ` AND search_vector @@ plainto_tsquery('german', $${countParamIndex})`;
        countParams.push(query.trim());
        countParamIndex++;
    }
    if (manufacturer) {
        countSql += ` AND manufacturer = $${countParamIndex}`;
        countParams.push(manufacturer);
        countParamIndex++;
    }
    if (category) {
        countSql += ` AND category = $${countParamIndex}`;
        countParams.push(category);
    }

    const countResult = await db.query(countSql, countParams);

    return {
        products: result.rows,
        totalCount: parseInt(countResult.rows[0].count)
    };
}

/**
 * Get all manufacturers with product counts
 * @returns {Array} Array of { manufacturer, product_count }
 */
async function getManufacturers() {
    const result = await db.query(`
        SELECT
            manufacturer,
            COUNT(*) as product_count
        FROM products
        WHERE active = true
        GROUP BY manufacturer
        ORDER BY manufacturer ASC
    `);
    return result.rows;
}

/**
 * Get categories that appear for a specific manufacturer
 * @param {string} manufacturer - Manufacturer name
 * @returns {Array} Array of { category, product_count }
 */
async function getCategoriesForManufacturer(manufacturer) {
    const result = await db.query(`
        SELECT
            category,
            COUNT(*) as product_count
        FROM products
        WHERE active = true
          AND manufacturer = $1
          AND category IS NOT NULL
        GROUP BY category
        ORDER BY category ASC
    `, [manufacturer]);
    return result.rows;
}

/**
 * Get a single product by SKU
 * @param {string} sku - Product SKU
 * @returns {Object|null} Product object or null if not found/inactive
 */
async function getProductBySku(sku) {
    const result = await db.query(`
        SELECT *
        FROM products
        WHERE sku = $1
          AND active = true
    `, [sku]);

    return result.rows.length > 0 ? result.rows[0] : null;
}

module.exports = {
    searchProducts,
    getManufacturers,
    getCategoriesForManufacturer,
    getProductBySku
};
