# ISSUE-004: Search and Filtering Functionality

**Status**: ✅ RESOLVED
**Date**: 2024-11-20
**Type**: Feature - Phase 4
**Component**: Backend, Frontend
**Assignee**: Claude Code
**Depends On**: ISSUE-003

---

## Objective

Add full-text search, manufacturer filtering, and category filtering to the product catalog. Enable users to find products using search queries and faceted navigation.

---

## Scope

This is Phase 4 of the incremental implementation. Transform the basic product listing into a fully searchable and filterable catalog.

**Deliverables:**
1. Full-text search using PostgreSQL tsvector
2. Manufacturer filter with product counts
3. Category filter (contextual to manufacturer)
4. Sidebar navigation with active filters
5. Functional search form in header
6. Combined search + filter queries

---

## Implementation Plan

### 1. Enhanced Product Model

**File**: `src/models/product.js` (modify existing)

**New Functions:**
- `searchProducts({ query, manufacturer, category, page, limit })` - Combined search and filter
- `getManufacturers()` - Get all manufacturers with product counts
- `getCategoriesForManufacturer(manufacturer)` - Get categories for a specific manufacturer
- Replace `getAllProducts()` with `searchProducts()` (backwards compatible)

**Key Features:**
- Use `search_vector @@ plainto_tsquery('german', query)` for full-text search
- Rank results by `ts_rank()` when search query present
- Build dynamic WHERE clauses based on filters
- Parameterized queries to prevent SQL injection

### 2. Updated Products Route

**File**: `src/routes/products.js` (modify existing)

**Changes:**
- Accept query params: `q`, `manufacturer`, `category`, `page`
- Call `searchProducts()` with all filters
- Fetch manufacturers list for sidebar
- Fetch categories if manufacturer is selected
- Pass filter state to template

### 3. Sidebar Navigation

**File**: `src/views/partials/sidebar.ejs`

**Sections:**
1. **Manufacturers** - Always visible
   - List all manufacturers with product counts
   - Highlight active manufacturer
   - Link to `/products?manufacturer=X`

2. **Categories** - Visible when manufacturer selected
   - Show categories for selected manufacturer
   - Display product counts
   - Link to `/products?manufacturer=X&category=Y`
   - Highlight active category

### 4. Functional Search Form

**File**: `src/views/partials/header.ejs` (modify existing)

**Changes:**
- Make search form submit to `/products`
- Include hidden inputs to preserve filters
- Pre-populate search input with current query
- Pre-select manufacturer dropdown
- Add "Search" button

### 5. Filter State Management

**Template Changes:**
- Update `layout.ejs` to pass filter state to sidebar
- Update `products.ejs` to show active filters
- Update `pagination.ejs` to preserve filters in page links

### 6. User Experience Enhancements

**Visual Indicators:**
- Show "X results for 'query'" when searching
- Show "Products from Manufacturer X" when filtered
- Show active filter highlighting in sidebar
- Display "Clear filters" option when filters active

---

## Acceptance Criteria

- [ ] Search form in header is functional
- [ ] Typing in search box and clicking "Search" returns relevant results
- [ ] Results are ranked by relevance when searching
- [ ] Results show German language matches (ä, ö, ü work correctly)
- [ ] Manufacturer list appears in sidebar with counts
- [ ] Clicking manufacturer filters products
- [ ] Category list appears when manufacturer selected
- [ ] Clicking category further filters products
- [ ] Active filters are visually highlighted
- [ ] Pagination preserves all active filters
- [ ] Combining search + manufacturer + category works
- [ ] No filters returns all products
- [ ] Empty search results show "No products found"

---

## Testing Scenarios

### 1. Full-Text Search
```bash
# Test German language search
/products?q=dental
/products?q=spiegel  # German for mirror
/products?q=implant

# Test partial matches
/products?q=komposit  # Should find "Composite"
```

### 2. Manufacturer Filter
```bash
# Filter by manufacturer
/products?manufacturer=Brand%20X

# Should show:
- Only products from Brand X
- Category list for Brand X in sidebar
- Highlighted "Brand X" in manufacturer list
```

### 3. Combined Filters
```bash
# Search within manufacturer
/products?q=implant&manufacturer=Brand%20Z

# Manufacturer + category
/products?manufacturer=Brand%20X&category=Instruments

# All three filters
/products?q=mirror&manufacturer=Brand%20X&category=Instruments
```

### 4. Pagination with Filters
```bash
# Page 2 with filters
/products?q=dental&manufacturer=Brand%20X&page=2

# Should maintain all filters
```

### 5. Edge Cases
```bash
# No results
/products?q=nonexistent

# Special characters
/products?q=ä%ö%ü

# Empty query (should show all)
/products?q=
```

---

## Database Query Examples

### Search Vector Query
```sql
SELECT * FROM products
WHERE active = true
  AND search_vector @@ plainto_tsquery('german', 'implant')
ORDER BY ts_rank(search_vector, plainto_tsquery('german', 'implant')) DESC
LIMIT 48;
```

### Combined Filters Query
```sql
SELECT * FROM products
WHERE active = true
  AND search_vector @@ plainto_tsquery('german', $1)
  AND manufacturer = $2
  AND category = $3
ORDER BY ts_rank(search_vector, plainto_tsquery('german', $1)) DESC
LIMIT 48 OFFSET 0;
```

### Manufacturer List Query
```sql
SELECT manufacturer, COUNT(*) as product_count
FROM products
WHERE active = true
GROUP BY manufacturer
ORDER BY manufacturer ASC;
```

---

## Files to Modify

1. `/src/models/product.js` - Add search and filter functions
2. `/src/routes/products.js` - Handle query parameters
3. `/src/views/layout.ejs` - Pass filter state to sidebar
4. `/src/views/products.ejs` - Show filter state and clear option
5. `/src/views/partials/header.ejs` - Make search form functional
6. `/src/views/partials/sidebar.ejs` - Create sidebar (new file or modify)
7. `/src/views/partials/pagination.ejs` - Preserve filters in URLs
8. `/public/style.css` - Style sidebar and active states

---

## Technical Considerations

**SQL Injection Prevention:**
- Always use parameterized queries
- Never concatenate user input into SQL strings
- Use `$1, $2, $3` placeholders

**Performance:**
- Leverage GIN index on search_vector
- Use B-tree indexes on manufacturer, category
- EXPLAIN ANALYZE queries to verify index usage

**German Language:**
- PostgreSQL 'german' text search configuration handles:
  - Stemming (e.g., "implants" → "implant")
  - Stop words
  - Umlauts (ä, ö, ü)

**URL Encoding:**
- Use `encodeURIComponent()` in templates for manufacturer/category names
- Handle spaces and special characters correctly

---

## User Experience Details

**Active Filter Display:**
```
Products from Brand X > Instruments (23 results)

[Clear all filters]
```

**Search Results:**
```
42 results for "dental implant"
```

**No Results:**
```
No products found for "xyz".

Try:
- Different keywords
- Browsing by manufacturer
```

---

## Next Steps (Future Issues)

After this issue is resolved:
- ISSUE-005: Add product detail pages
- ISSUE-006: Polish CSS and responsive design

---

## References

- Implementation spec: `docs/implementation specification.md` lines 247-391
- PostgreSQL text search: https://www.postgresql.org/docs/current/textsearch.html
- German text search config: https://www.postgresql.org/docs/current/textsearch-dictionaries.html
