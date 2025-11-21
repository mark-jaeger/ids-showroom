const db = require('../src/config/database');

async function setupDatabase() {
    try {
        console.log('📊 Creating database schema...');

        // Create products table
        await db.query(`
            CREATE TABLE IF NOT EXISTS products (
                id SERIAL PRIMARY KEY,
                sku VARCHAR(50) UNIQUE NOT NULL,
                name TEXT NOT NULL,
                manufacturer VARCHAR(255),
                category VARCHAR(255),
                variant_name VARCHAR(255),
                manufacturer_number VARCHAR(100),
                description TEXT,
                image_url TEXT,
                active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✓ Products table created');

        // Create indexes
        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
            CREATE INDEX IF NOT EXISTS idx_products_manufacturer ON products(manufacturer);
            CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
            CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);
        `);
        console.log('✓ Indexes created');

        // Create full-text search vector
        await db.query(`
            ALTER TABLE products
            ADD COLUMN IF NOT EXISTS search_vector tsvector;
        `);

        // Create full-text search index
        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_products_search
            ON products USING gin(search_vector);
        `);
        console.log('✓ Full-text search index created');

        // Create trigger to update search_vector
        await db.query(`
            CREATE OR REPLACE FUNCTION products_search_trigger() RETURNS trigger AS $$
            BEGIN
                NEW.search_vector :=
                    setweight(to_tsvector('german', coalesce(NEW.name, '')), 'A') ||
                    setweight(to_tsvector('german', coalesce(NEW.manufacturer, '')), 'B') ||
                    setweight(to_tsvector('german', coalesce(NEW.category, '')), 'C') ||
                    setweight(to_tsvector('german', coalesce(NEW.sku, '')), 'D');
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;

            DROP TRIGGER IF EXISTS tsvector_update ON products;
            CREATE TRIGGER tsvector_update
                BEFORE INSERT OR UPDATE ON products
                FOR EACH ROW EXECUTE FUNCTION products_search_trigger();
        `);
        console.log('✓ Search trigger created');

        console.log('✅ Database schema created successfully');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error creating schema:', error);
        process.exit(1);
    }
}

setupDatabase();
