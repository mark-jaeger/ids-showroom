const express = require('express');
const router = express.Router();
const {
    getProductBySku,
    getCategoriesForManufacturer
} = require('../models/product');

/**
 * GET /product/:sku
 * Product detail page
 */
router.get('/product/:sku', async (req, res) => {
    try {
        const sku = req.params.sku;

        // Fetch product by SKU
        const product = await getProductBySku(sku);

        // Return 404 if product not found or inactive
        if (!product) {
            return res.status(404).render('404', {
                title: 'Produkt nicht gefunden',
                message: 'Das gesuchte Produkt konnte nicht gefunden werden.',
                sku
            });
        }

        // Fetch categories for the product's manufacturer (for sidebar)
        const categories = await getCategoriesForManufacturer(product.manufacturer);

        // Render product detail template
        res.render('product', {
            title: `${product.name} - ${product.manufacturer}`,
            product,
            categories
        });
    } catch (error) {
        console.error('Error in /product/:sku:', error);
        res.status(500).send('Server error');
    }
});

module.exports = router;
