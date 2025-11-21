const { Pool } = require('pg');

// Create PostgreSQL connection pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false // Railway requires this
    } : false,
    max: 20,                      // Maximum number of clients in pool
    idleTimeoutMillis: 30000,     // Close idle clients after 30 seconds
    connectionTimeoutMillis: 2000 // Return error after 2 seconds if unable to connect
});

// Test connection on startup
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('❌ Database connection failed:', err.message);
        if (process.env.NODE_ENV === 'production') {
            process.exit(1);
        }
    } else {
        console.log('✓ Database connection established');
    }
});

pool.on('error', (err) => {
    console.error('Unexpected database error:', err);
    if (process.env.NODE_ENV === 'production') {
        process.exit(-1);
    }
});

module.exports = pool;
