# ISSUE-002: CSV Import Script

**Status**: ✅ RESOLVED
**Date**: 2024-11-20
**Type**: Feature - Phase 2
**Component**: Data Import, Scripts
**Assignee**: Claude Code
**Depends On**: ISSUE-001

---

## Objective

Create a CSV import script to load product data from CSV files into the PostgreSQL database. This enables testing with real data from the start.

---

## Scope

This is Phase 2 of the incremental implementation. Build the data import pipeline before the web application, so we can develop and test with actual product data.

**Deliverables:**
1. CSV import script (`scripts/import-csv.js`)
2. HTML sanitization for product descriptions
3. Category extraction logic (leaf category from cat1/cat2/cat3/cat4)
4. Deduplication handling (upsert on SKU)
5. Import history tracking
6. Error handling and reporting
7. Sample CSV data for testing

---

## CSV Structure

**Expected columns:**
- `artikelnummer` - Product SKU (required)
- `produktname` - Product name (required)
- `variant_name` - Variant name (optional)
- `manufacturer` - Manufacturer name (required)
- `manufacturer_number` - Manufacturer's product number (optional)
- `product_group` - Product group (optional)
- `produktbeschreibung` - HTML description (optional)
- `image_url` - Product image URL (optional)
- `cat1`, `cat2`, `cat3`, `cat4` - Category hierarchy (optional)

**Data cleaning requirements:**
- Handle "nan" values (convert to null)
- Sanitize HTML descriptions (remove scripts, dangerous tags)
- Extract leaf category from hierarchy
- Deduplicate within CSV file
- Upsert on SKU conflict

---

## Implementation Plan

### 1. Import Script Structure

**File**: `scripts/import-csv.js`

**Functions:**
- `sanitizeDescription(html)` - Clean HTML, allow safe tags only
- `getLeafCategory(row)` - Extract deepest category from cat1-cat4
- `importCSV(filepath)` - Main import function
- CLI execution handler

**Features:**
- Read CSV with `csv-parse`
- Process rows sequentially
- Track success/failure counts
- Log errors with SKU reference
- Record import history in database
- Progress reporting (every 100 rows)

### 2. HTML Sanitization

**Safe tags allowed:**
- `<p>` - Paragraphs
- `<ul>`, `<li>` - Lists
- `<b>`, `<strong>` - Bold
- `<i>`, `<em>` - Italic
- `<h3>` - Subheadings

**Strip everything else:**
- `<script>` tags
- `<style>` tags
- Event handlers
- All attributes
- Dangerous tags

### 3. Category Extraction Logic

```javascript
function getLeafCategory(row) {
    // Return deepest non-null category
    if (row.cat4 && row.cat4 !== 'nan') return row.cat4;
    if (row.cat3 && row.cat3 !== 'nan') return row.cat3;
    if (row.cat2 && row.cat2 !== 'nan') return row.cat2;
    if (row.cat1 && row.cat1 !== 'nan') return row.cat1;
    return null;
}
```

### 4. Upsert Logic

```sql
INSERT INTO products (sku, name, ...)
VALUES ($1, $2, ...)
ON CONFLICT (sku)
DO UPDATE SET
    name = EXCLUDED.name,
    ...
    updated_at = NOW()
```

**Behavior:**
- If SKU exists: Update all fields
- If SKU is new: Insert new row
- Allows re-importing same CSV (idempotent)

### 5. Error Handling

**Handle errors:**
- Missing required fields (artikelnummer, produktname)
- Database constraints violations
- Invalid data types
- CSV parsing errors

**Error reporting:**
- Collect all errors during import
- Report at end with SKU reference
- Store in import_history table
- Don't stop on single row failure

### 6. Progress Reporting

```bash
Starting import from: data/products.csv
Found 1523 rows in CSV
  Processed 100 products...
  Processed 200 products...
  Processed 300 products...
  ...
✓ Import complete:
  Success: 1520
  Failed: 3

  Errors:
    - SKU-123: Missing required field: produktname
    - SKU-456: Invalid data type
    - SKU-789: Constraint violation
```

### 7. Package.json Script

```json
{
  "scripts": {
    "import": "node scripts/import-csv.js"
  }
}
```

**Usage:**
```bash
npm run import data/products.csv
```

---

## Acceptance Criteria

- [ ] Script reads CSV files successfully
- [ ] Required fields (artikelnummer, produktname) are validated
- [ ] Missing fields don't crash import
- [ ] "nan" values are converted to null
- [ ] HTML descriptions are sanitized (no script tags)
- [ ] Safe HTML tags are preserved (p, ul, li, b, strong, i, em, h3)
- [ ] Leaf category is extracted correctly from cat1-cat4
- [ ] Duplicate SKUs within CSV are handled (last one wins)
- [ ] Duplicate SKUs in database are updated (upsert)
- [ ] Progress is reported every 100 rows
- [ ] Final summary shows success/failure counts
- [ ] Errors are logged with SKU reference
- [ ] Import history is recorded in database
- [ ] Script exits with code 0 on success, 1 on failure
- [ ] Can re-import same CSV without duplicates

---

## Testing Scenarios

### 1. Valid CSV Import
```bash
npm run import data/sample.csv

# Should:
- Import all valid rows
- Show progress
- Report success count
- No errors
```

### 2. CSV with Missing Fields
```csv
artikelnummer,produktname,manufacturer
TEST-001,,Brand X
TEST-002,Product B,Brand Y
```

```bash
# Should:
- Skip TEST-001 (missing produktname)
- Import TEST-002 successfully
- Report 1 success, 1 failure
- Log error for TEST-001
```

### 3. CSV with "nan" Values
```csv
artikelnummer,produktname,variant_name,manufacturer
TEST-001,Product A,nan,Brand X
```

```bash
# Should:
- Import with variant_name = null
- Not show "nan" in database
```

### 4. HTML Sanitization
```csv
artikelnummer,produktname,produktbeschreibung,manufacturer
TEST-001,Product A,"<p>Safe content</p><script>alert('xss')</script>",Brand X
```

```bash
# Should:
- Preserve <p> tag
- Remove <script> tag
- Store: "<p>Safe content</p>"
```

### 5. Category Extraction
```csv
artikelnummer,produktname,cat1,cat2,cat3,cat4,manufacturer
TEST-001,Product A,Cat1,Cat2,Cat3,Cat4,Brand X
TEST-002,Product B,Cat1,Cat2,nan,nan,Brand Y
```

```bash
# Should:
- TEST-001: category = "Cat4"
- TEST-002: category = "Cat2"
```

### 6. Re-import (Upsert)
```bash
# First import
npm run import data/products.csv
# 100 products imported

# Modify CSV and re-import
npm run import data/products.csv
# 100 products updated (not duplicated)

# Verify: SELECT COUNT(*) FROM products;
# Should still be 100
```

### 7. Large CSV
```bash
npm run import data/large-catalog.csv
# 10,000+ rows

# Should:
- Import without memory issues
- Show progress regularly
- Complete successfully
```

---

## Files to Create

1. `/scripts/import-csv.js` - Import script
2. `/data/sample.csv` - Sample data for testing (optional)

### Modified Files
1. `/package.json` - Add csv-parse and sanitize-html dependencies

---

## Dependencies to Add

```json
{
  "dependencies": {
    "csv-parse": "^5.5.0",
    "sanitize-html": "^2.11.0"
  }
}
```

---

## Sample CSV for Testing

Create `/data/sample.csv`:

```csv
artikelnummer,produktname,variant_name,manufacturer,manufacturer_number,product_group,produktbeschreibung,image_url,cat1,cat2,cat3,cat4
TEST-001,Dentalspiegel #5,Standard,Brand X,BX-12345,Instrumente,"<p>Hochwertiger Dentalspiegel für die tägliche Praxis.</p><ul><li>Rostfreier Stahl</li><li>Ergonomischer Griff</li></ul>",https://placehold.co/400x300,Instrumente,Spiegel,nan,nan
TEST-002,Komposit-Kit,Premium Set,Brand Y,BY-67890,Restaurative,"<p>Komplettes Komposit-Set für alle Restaurationen.</p>",https://placehold.co/400x300,Restaurative,Komposite,Füllungen,nan
TEST-003,Implantat-System,4.0mm x 10mm,Brand Z,BZ-IMPL-410,Implantologie,"<p>Hochwertiges Implantatsystem mit hervorragender Osseointegration.</p><ul><li>Titan Grad 4</li><li>Selbstschneidend</li><li>Kegelförmiges Design</li></ul>",https://placehold.co/400x300,Implantologie,Implantate,Systeme,Schraube
TEST-004,Prophylaxe-Paste,Minze-Geschmack,Brand X,BX-PROPH-01,Prophylaxe,<p>Fluoridhaltige Prophylaxe-Paste mit angenehmem Minzgeschmack.</p>,nan,Prophylaxe,Pasten,nan,nan
TEST-005,Absaugkanüle,Steril 50 Stk,Brand Y,nan,Verbrauchsmaterial,<p>Sterile Einweg-Absaugkanülen im 50er Pack.</p>,https://placehold.co/400x300,Verbrauchsmaterial,Absaugung,Kanülen,nan
```

---

## Technical Notes

**CSV Parsing:**
- Use `csv-parse` library (not native parsing)
- Enable `columns: true` for header mapping
- Handle BOM (Byte Order Mark) for Excel CSVs
- Trim whitespace from values

**Database Transactions:**
- Consider using transactions for large imports (future enhancement)
- For now, individual inserts are acceptable
- Import history records overall result

**Memory Management:**
- Read CSV into memory (acceptable for <100k rows)
- For very large CSVs, consider streaming (future)
- Track seen SKUs in Set for deduplication

**Security:**
- Sanitize HTML to prevent XSS
- Use parameterized queries (no SQL injection)
- Don't trust CSV data blindly

---

## Performance Considerations

**For 1,000 products:**
- Should complete in < 10 seconds
- Progress updates keep user informed
- No memory issues

**For 10,000+ products:**
- May take 1-2 minutes
- Consider batch inserts (future optimization)
- Stream processing (future enhancement)

---

## Next Steps (Future Issues)

After this issue is resolved:
- ISSUE-003: Express app + basic listing (will use real data)
- ISSUE-004: Search and filtering (test with real data)
- ISSUE-005: Product detail pages
- ISSUE-006: CSS polish

---

## References

- Implementation spec: `docs/implementation specification.md` lines 1174-1332
- csv-parse docs: https://csv.js.org/parse/
- sanitize-html docs: https://www.npmjs.com/package/sanitize-html
- PostgreSQL UPSERT: https://www.postgresql.org/docs/current/sql-insert.html (ON CONFLICT)
