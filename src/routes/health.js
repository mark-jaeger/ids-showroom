const express = require('express');
const router = express.Router();
const db = require('../config/database');

/**
 * GET /health
 * Health check endpoint for monitoring
 */
router.get('/health', async (req, res) => {
    try {
        // Check database connection
        const result = await db.query('SELECT 1 as health');

        res.status(200).json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            database: 'connected',
            environment: process.env.NODE_ENV || 'development'
        });
    } catch (error) {
        res.status(503).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            database: 'disconnected',
            error: error.message,
            environment: process.env.NODE_ENV || 'development'
        });
    }
});

module.exports = router;
