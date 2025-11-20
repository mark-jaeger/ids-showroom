const db = require('../config/database');

/**
 * Get all products with pagination
 * @param {number} page - Page number (1-indexed)
 * @param {number} limit - Products per page
 * @returns {Object} { products: Array, totalCount: number }
 */
async function getAllProducts({ page = 1, limit = 48 }) {
    const offset = (page - 1) * limit;

    // Get products for current page
    const productsQuery = `
        SELECT *
        FROM products
        WHERE active = true
        ORDER BY name ASC
        LIMIT $1 OFFSET $2
    `;

    const productsResult = await db.query(productsQuery, [limit, offset]);

    // Get total count for pagination
    const countQuery = 'SELECT COUNT(*) FROM products WHERE active = true';
    const countResult = await db.query(countQuery);

    return {
        products: productsResult.rows,
        totalCount: parseInt(countResult.rows[0].count)
    };
}

module.exports = {
    getAllProducts
};
