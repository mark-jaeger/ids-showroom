const express = require('express');
const router = express.Router();
const {
    searchProducts,
    getManufacturers,
    getCategoriesForManufacturer
} = require('../models/product');

/**
 * GET /products
 * Main listing page with optional filters
 * Query params:
 *   - q: search query
 *   - manufacturer: manufacturer name
 *   - category: category name
 *   - page: page number
 */
router.get('/products', async (req, res) => {
    try {
        const query = req.query.q || '';
        const manufacturer = req.query.manufacturer || null;
        const category = req.query.category || null;
        const page = parseInt(req.query.page) || 1;

        const { products, totalCount } = await searchProducts({
            query,
            manufacturer,
            category,
            page,
            limit: 48
        });

        // Get manufacturers for sidebar
        const manufacturers = await getManufacturers();

        // Get categories if manufacturer is filtered
        let categories = [];
        if (manufacturer) {
            categories = await getCategoriesForManufacturer(manufacturer);
        }

        // Build title based on filters
        let title = 'Alle Produkte';
        if (manufacturer && category) {
            title = `${manufacturer} - ${category}`;
        } else if (manufacturer) {
            title = `Produkte von ${manufacturer}`;
        } else if (query) {
            title = `Suchergebnisse für "${query}"`;
        }

        res.render('products', {
            title,
            products,
            manufacturers,
            categories,
            filters: {
                query,
                manufacturer,
                category
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
