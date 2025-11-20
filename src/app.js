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

app.use('/', productsRoutes);

// Error handling
app.use((req, res) => {
    res.status(404).send('Page not found');
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
