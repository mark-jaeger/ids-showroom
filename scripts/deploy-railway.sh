#!/bin/bash
# Complete Railway deployment with CSV import

set -e  # Exit on error

echo "🚀 Starting Railway deployment..."

# Step 1: Setup database schema
echo "📊 Setting up database schema..."
railway run node scripts/setup-database.js

# Step 2: Import CSV data
echo "📥 Importing product data from CSV..."
railway run npm run import-data

# Step 3: Verify import
echo "✓ Verifying data import..."
railway run node -e "
const db = require('./src/config/database');
db.query('SELECT COUNT(*) FROM products')
  .then(res => {
    console.log('Total products imported:', res.rows[0].count);
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
"

echo "✅ Deployment complete!"
