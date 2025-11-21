const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
require('dotenv').config();

const app = express();

// Security & performance middleware
app.use(helmet({
    contentSecurityPolicy: false // Allow inline styles for now (will fix in Phase 6)
}));
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// View engine
app.set('view engine', 'ejs');
app.set('views', './src/views');

// Routes
const productsRoutes = require('./routes/products');
const productRoutes = require('./routes/product');
const healthRoutes = require('./routes/health');

app.use('/', healthRoutes);
app.use('/', productsRoutes);
app.use('/', productRoutes);

// Error handling
app.use((req, res) => {
    res.status(404).send('Page not found');
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0'; // Railway requires binding to all interfaces
const server = app.listen(PORT, HOST, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Binding to: ${HOST}:${PORT}`);
});

// Graceful shutdown
const shutdown = () => {
    console.log('\nReceived shutdown signal, closing HTTP server...');
    server.close(() => {
        console.log('HTTP server closed');
        const db = require('./config/database');
        db.end(() => {
            console.log('Database pool closed');
            process.exit(0);
        });
    });

    // Force close after 10 seconds
    setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
