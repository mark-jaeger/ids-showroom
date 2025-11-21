# ISSUE-007: SEO-Friendly URLs with Hierarchical Categories

**Status**: Pending
**Date**: 2024-11-20
**Type**: Enhancement - SEO & URL Structure
**Component**: Backend, Routes
**Assignee**: Claude Code
**Depends On**: ISSUE-005
**Priority**: Medium

---

## Objective

Implement SEO-friendly URLs that include hierarchical category names and product names in the URL path. This improves search engine optimization, user experience, and URL readability.

---

## Current URL Structure

**Products:**
- `/product/67398` (SKU only)

**Category Filtering:**
- `/products?manufacturer=Spitta%20Verlag&category=Bonding` (query parameters)

---

## Proposed URL Structure

### Product Detail Pages

**Format:**
```
/product/{category-slug}/{product-name-slug}/{sku}
```

**Examples:**
```
Current:  /product/67398
Proposed: /product/spiegel/dentalspiegel-5/67398

Current:  /product/TEST-002
Proposed: /product/bonding/komposit-kit/TEST-002

Current:  /product/132063
Proposed: /product/3d-druck-geraete/scanner-intraoral/132063
```

**Benefits:**
- Human-readable URLs
- SEO keywords in URL path
- Hierarchical category visible in breadcrumb trail
- Better Google search result previews
- Users can understand page content from URL alone

### Category Pages

**Format:**
```
/products/{manufacturer-slug}/{category-slug}
```

**Examples:**
```
Current:  /products?manufacturer=Spitta%20Verlag&category=Bonding
Proposed: /products/spitta-verlag/bonding

Current:  /products?manufacturer=Brand%20X
Proposed: /products/brand-x
```

**All Products:**
```
/products (remains unchanged)
```

---

## Implementation Plan

### 1. Create URL Slugification Utility

**File:** `src/utils/slugify.js` (new file)

**Functions:**
- `slugify(text)` - Convert text to URL-safe slug
  - Lowercase conversion
  - Replace spaces with hyphens
  - Remove special characters (except hyphens)
  - Handle German umlauts (ä→ae, ö→oe, ü→ue, ß→ss)
  - Remove leading/trailing hyphens
  - Collapse multiple hyphens

**Example:**
```javascript
slugify("Dentalspiegel #5") // → "dentalspiegel-5"
slugify("3D-Druck Geräte") // → "3d-druck-geraete"
slugify("Spitta Verlag") // → "spitta-verlag"
```

### 2. Update Product Routes

**File:** `src/routes/product.js` (modify)

**New Routes:**

```javascript
// SEO-friendly product detail URL
GET /product/:categorySlug/:nameSlug/:sku

// Backward compatibility - redirect old URLs
GET /product/:sku → redirect to new URL format
```

**Route Handler Logic:**
1. Extract SKU from URL
2. Fetch product using `getProductBySku(sku)`
3. If old URL format (just SKU), redirect to new URL:
   - Generate category slug from product.category
   - Generate name slug from product.name
   - 301 redirect to `/product/{categorySlug}/{nameSlug}/{sku}`
4. If new URL format, verify slugs match product data
   - If slugs don't match (outdated URL), redirect to correct URL
   - If slugs match, render product page

**Slug Verification:**
- Prevents broken links when product names/categories change
- Always uses SKU as source of truth
- Redirects to canonical URL if slugs are outdated

### 3. Update Products Listing Routes

**File:** `src/routes/products.js` (modify)

**New Routes:**

```javascript
// SEO-friendly category URLs
GET /products/:manufacturerSlug/:categorySlug
GET /products/:manufacturerSlug

// Keep query parameter version for backward compatibility
GET /products?manufacturer=X&category=Y → redirect to new URL
GET /products?manufacturer=X → redirect to new URL
```

**Route Handler Logic:**
1. Extract manufacturer/category slugs from URL
2. Query database to find matching manufacturer/category
   - Use slug → name mapping or reverse-slugify
3. If found, render products page with filters
4. If query parameters used, redirect to SEO-friendly URL
5. If no filters, show all products (remains `/products`)

### 4. Update Product Card Links

**File:** `src/views/partials/product-card.ejs` (modify)

**Change:**
```ejs
<!-- Old -->
<a href="/product/<%= product.sku %>">

<!-- New -->
<a href="/product/<%= slugify(product.category) %>/<%= slugify(product.name) %>/<%= product.sku %>">
```

**Note:** Need to pass `slugify` function to templates via response locals

### 5. Update Navigation Links

**Files to Update:**
- `src/views/partials/sidebar.ejs` - Category and manufacturer links
- `src/views/product.ejs` - Breadcrumb links and "More from" button

**Changes:**
```ejs
<!-- Manufacturer link -->
<a href="/products/<%= slugify(manufacturer) %>">

<!-- Category link -->
<a href="/products/<%= slugify(manufacturer) %>/<%= slugify(category) %>">
```

### 6. Add Slugify to Template Locals

**File:** `src/app.js` (modify)

**Middleware:**
```javascript
const { slugify } = require('./utils/slugify');

// Make slugify available in all templates
app.use((req, res, next) => {
    res.locals.slugify = slugify;
    next();
});
```

### 7. Database Considerations

**Optional Enhancement:**
- Add `slug` column to products table for pre-computed slugs
- Create index on slug column for faster lookups
- Generate slugs during CSV import

**For MVP:**
- Generate slugs on-the-fly in route handlers
- No database changes needed
- Slightly slower but simpler implementation

---

## URL Slug Matching Strategy

### Option A: Strict Matching (Recommended)
- URL slugs must exactly match current product data
- If slugs outdated → 301 redirect to correct URL
- SKU is always source of truth
- Maintains SEO juice through redirects

### Option B: Loose Matching
- Accept any slugs in URL, only validate SKU
- Simpler implementation
- Risk of multiple URLs for same product (bad for SEO)
- Not recommended

**Implementation: Use Option A (Strict Matching)**

---

## Backward Compatibility

### Old URLs Must Redirect

**Product Pages:**
```
/product/67398 → /product/spiegel/dentalspiegel-5/67398 (301)
```

**Category Pages:**
```
/products?manufacturer=Brand%20X → /products/brand-x (301)
/products?manufacturer=Brand%20X&category=Bonding → /products/brand-x/bonding (301)
```

**Benefits:**
- Existing bookmarks continue to work
- Search engine indexed URLs redirect properly
- No broken links
- SEO value preserved through 301 redirects

---

## Edge Cases to Handle

### 1. Products Without Categories
```
Product with category = NULL
URL: /product/uncategorized/{nameSlug}/{sku}
or:  /product/{nameSlug}/{sku} (skip category segment)
```

### 2. Special Characters in Names
```
"Komposit-Kit (5ml)" → "komposit-kit-5ml"
"Absauganlagen / Technik" → "absauganlagen-technik"
```

### 3. Very Long Product Names
```
Truncate to 50 chars + hash for uniqueness?
or: Allow full slug (URLs can be 2000+ chars)
Recommendation: Allow full slug, browsers support it
```

### 4. Duplicate Slugs
```
Two products: "Scanner Pro" and "Scanner-Pro!"
Both slug to: "scanner-pro"
Solution: SKU differentiates them
- /product/category/scanner-pro/SKU-001
- /product/category/scanner-pro/SKU-002
```

### 5. Category Name Changes
```
Category renamed: "3D Druck" → "3D-Druck Systeme"
Old URL: /products/manufacturer/3d-druck
New URL: /products/manufacturer/3d-druck-systeme
→ Redirect old to new (301)
```

---

## Testing Scenarios

### 1. Product Detail URL Generation
```bash
# Test new URL format
http://localhost:3000/product/spiegel/dentalspiegel-5/TEST-001
→ Should render product page

# Test backward compatibility
http://localhost:3000/product/TEST-001
→ Should redirect to: /product/spiegel/dentalspiegel-5/TEST-001
```

### 2. Category URL Generation
```bash
# Test manufacturer-only filter
http://localhost:3000/products/brand-x
→ Should show Brand X products

# Test manufacturer + category filter
http://localhost:3000/products/brand-x/bonding
→ Should show Brand X Bonding products

# Test backward compatibility
http://localhost:3000/products?manufacturer=Brand%20X
→ Should redirect to: /products/brand-x
```

### 3. Slug Mismatch Handling
```bash
# Outdated product name in URL
http://localhost:3000/product/spiegel/old-name/TEST-001
→ Should redirect to: /product/spiegel/dentalspiegel-5/TEST-001

# Wrong category in URL
http://localhost:3000/product/wrong-category/dentalspiegel-5/TEST-001
→ Should redirect to: /product/spiegel/dentalspiegel-5/TEST-001
```

### 4. Special Characters
```bash
# German umlauts
Product: "Röntgen Geräte"
URL: /products/manufacturer/roentgen-geraete

# Slashes and special chars
Product: "Kit (5ml) / Premium"
URL: /product/category/kit-5ml-premium/SKU
```

### 5. Missing Categories
```bash
# Product with NULL category
http://localhost:3000/product/dentalspiegel-5/TEST-001
→ Should render (category segment omitted)
```

---

## Acceptance Criteria

- [ ] Product URLs include category slug, name slug, and SKU
- [ ] Category URLs use manufacturer and category slugs
- [ ] Slugify utility handles German umlauts correctly
- [ ] Old URLs redirect to new URLs with 301 status
- [ ] Outdated slugs redirect to current slugs
- [ ] Product cards link to new URL format
- [ ] Breadcrumbs use new URL format
- [ ] Sidebar links use new URL format
- [ ] Search form redirects to SEO-friendly URLs
- [ ] URLs are lowercase and hyphen-separated
- [ ] Special characters removed from slugs
- [ ] Products without categories handled gracefully
- [ ] No broken links in application
- [ ] Redirects preserve query parameters if needed
- [ ] All tests pass

---

## Files to Create/Modify

### New Files
1. `/src/utils/slugify.js` - Slugification utility

### Modified Files
1. `/src/routes/product.js` - New URL format and redirects
2. `/src/routes/products.js` - Category/manufacturer slug routes
3. `/src/app.js` - Add slugify to template locals
4. `/src/views/partials/product-card.ejs` - Update links
5. `/src/views/partials/sidebar.ejs` - Update category/manufacturer links
6. `/src/views/product.ejs` - Update breadcrumb and button links
7. `/src/views/products.ejs` - Update any hardcoded links

---

## SEO Benefits

1. **Keyword-Rich URLs**: Category and product names in URL
2. **User-Friendly**: URLs clearly describe content
3. **Better Click-Through**: Users trust descriptive URLs in search results
4. **Breadcrumb Trail**: URL structure mirrors site hierarchy
5. **Social Sharing**: URLs look professional when shared
6. **Canonical URLs**: 301 redirects establish single canonical URL

---

## Performance Considerations

- Slugification is fast (string operations)
- Add caching layer if needed (store slugs in memory)
- Database slug column optional (future optimization)
- Redirects add one extra request (acceptable for SEO)

---

## Future Enhancements

1. **Hierarchical Categories**: If categories have parent-child relationships
   ```
   /product/dental-equipment/imaging/3d-scanners/product-name/SKU
   ```

2. **Multi-language URLs**: Different slugs for different languages
   ```
   /de/produkt/spiegel/dentalspiegel-5/SKU
   /en/product/mirrors/dental-mirror-5/SKU
   ```

3. **Slug History Table**: Track old slugs for permanent redirects
   ```sql
   CREATE TABLE slug_redirects (
     old_slug TEXT,
     new_slug TEXT,
     created_at TIMESTAMP
   );
   ```

---

## Implementation Order

1. Create slugify utility
2. Add slugify to template locals
3. Update product detail routes with backward compatibility
4. Update products listing routes with backward compatibility
5. Update all template links (product cards, sidebar, breadcrumbs)
6. Test all URL formats and redirects
7. Verify no broken links

---

## References

- Google SEO URL Structure: https://developers.google.com/search/docs/crawling-indexing/url-structure
- Express Route Parameters: https://expressjs.com/en/guide/routing.html
- HTTP 301 Redirects: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/301
