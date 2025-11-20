const express = require('express');
const router = express.Router();
const { getAllProducts } = require('../models/product');

/**
 * GET /products
 * Main listing page with pagination
 * Query params:
 *   - page: page number
 */
router.get('/products', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;

        const { products, totalCount } = await getAllProducts({
            page,
            limit: 48
        });

        res.render('products', {
            title: 'Alle Produkte',
            products,
            manufacturers: [], // Will be populated in Phase 4
            categories: [],    // Will be populated in Phase 4
            filters: {
                query: '',
                manufacturer: null,
                category: null
            },
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalCount / 48),
                totalCount
            }
        });
    } catch (error) {
        console.error('Error in /products:', error);
        res.status(500).send('Server error');
    }
});

/**
 * Redirect root to /products
 */
router.get('/', (req, res) => {
    res.redirect('/products');
});

module.exports = router;
