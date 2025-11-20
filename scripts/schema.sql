-- Dental Catalog Database Schema
-- PostgreSQL with full-text search support

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Drop existing tables if they exist (for clean re-runs)
DROP TABLE IF EXISTS import_history CASCADE;
DROP TABLE IF EXISTS products CASCADE;

-- Products table
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    sku VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(500) NOT NULL,
    variant_name VARCHAR(200),
    manufacturer VARCHAR(200) NOT NULL,
    manufacturer_number VARCHAR(200),
    product_group VARCHAR(200),
    description TEXT,  -- Sanitized HTML
    image_url VARCHAR(1000),
    category VARCHAR(200),  -- Flat category (leaf node from CSV)
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    -- Full-text search vector (German language)
    -- Generated column for automatic updates
    search_vector tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('german', coalesce(name, '')), 'A') ||
        setweight(to_tsvector('german', coalesce(variant_name, '')), 'A') ||
        setweight(to_tsvector('german', coalesce(manufacturer, '')), 'B') ||
        setweight(to_tsvector('german', coalesce(product_group, '')), 'B') ||
        setweight(to_tsvector('german', coalesce(sku, '')), 'C') ||
        setweight(to_tsvector('german', coalesce(
            regexp_replace(description, '<[^>]+>', '', 'g'),
        '')), 'D')
    ) STORED
);

-- Import history table
CREATE TABLE import_history (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255),
    rows_imported INTEGER,
    rows_failed INTEGER,
    errors JSONB,
    imported_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_products_search ON products USING GIN(search_vector);
CREATE INDEX idx_products_manufacturer ON products(manufacturer);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_active ON products(active) WHERE active = true;

-- Seed data for development and testing
INSERT INTO products (sku, name, variant_name, manufacturer, manufacturer_number, product_group, category, image_url, description)
VALUES
  (
    'TEST-001',
    'Dentalspiegel #5',
    'Standard',
    'Brand X',
    'BX-12345',
    'Instrumente',
    'Spiegel',
    'https://placehold.co/400x300',
    '<p>Hochwertiger Dentalspiegel für die tägliche Praxis.</p><ul><li>Rostfreier Stahl</li><li>Ergonomischer Griff</li></ul>'
  ),
  (
    'TEST-002',
    'Komposit-Kit',
    'Premium Set',
    'Brand Y',
    'BY-67890',
    'Restaurative',
    'Komposite',
    'https://placehold.co/400x300',
    '<p>Komplettes Komposit-Set für alle Restaurationen.</p>'
  ),
  (
    'TEST-003',
    'Implantat-System',
    '4.0mm x 10mm',
    'Brand Z',
    'BZ-IMPL-410',
    'Implantologie',
    'Implantate',
    'https://placehold.co/400x300',
    '<p>Hochwertiges Implantatsystem mit hervorragender Osseointegration.</p><ul><li>Titan Grad 4</li><li>Selbstschneidend</li><li>Kegelförmiges Design</li></ul>'
  ),
  (
    'TEST-004',
    'Prophylaxe-Paste',
    'Minze-Geschmack',
    'Brand X',
    'BX-PROPH-01',
    'Prophylaxe',
    'Pasten',
    NULL,
    '<p>Fluoridhaltige Prophylaxe-Paste mit angenehmem Minzgeschmack.</p>'
  ),
  (
    'TEST-005',
    'Absaugkanüle',
    'Steril 50 Stk',
    'Brand Y',
    NULL,
    'Verbrauchsmaterial',
    'Absaugung',
    'https://placehold.co/400x300',
    '<p>Sterile Einweg-Absaugkanülen im 50er Pack.</p>'
  );

-- Verify setup
SELECT 'Database schema created successfully!' AS status;
SELECT COUNT(*) AS seed_products FROM products;
