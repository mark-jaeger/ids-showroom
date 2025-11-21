const { Pool } = require('pg');

// Create PostgreSQL connection pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('railway') ? {
        rejectUnauthorized: false // Railway requires this
    } : false,
    max: 20,                         // Maximum number of clients in pool
    idleTimeoutMillis: 30000,        // Close idle clients after 30 seconds
    connectionTimeoutMillis: 10000,  // Increased to 10 seconds for Railway proxy
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000
});

// Test connection on startup (non-blocking)
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('❌ Database connection failed:', err.message);
        console.error('   Will retry on next query...');
    } else {
        console.log('✓ Database connection established');
    }
});

pool.on('error', (err) => {
    console.error('Unexpected database error:', err);
    console.error('Connection pool will attempt to recover...');
});

module.exports = pool;
