# ISSUE-005: Product Detail Pages (PDP)

**Status**: Pending
**Date**: 2024-11-20
**Type**: Feature - Phase 5
**Component**: Backend, Views
**Assignee**: Claude Code
**Depends On**: ISSUE-004

---

## Objective

Create product detail pages (PDPs) that display comprehensive information about individual products, including images, descriptions, specifications, and related navigation.

---

## Scope

This is Phase 5 of the incremental implementation. Add the final page type to complete the core catalog functionality.

**Deliverables:**
1. Product detail route (`/product/:sku`)
2. Product detail view template
3. Enhanced product model with single product query
4. Related products navigation
5. Breadcrumb navigation
6. Proper 404 handling for missing products

---

## Implementation Plan

### 1. Product Model Enhancement

**File**: `src/models/product.js` (modify existing)

**New Function:**
- `getProductBySku(sku)` - Fetch single product by SKU
- Return null if not found or inactive
- Include all product fields

### 2. Product Detail Route

**File**: `src/routes/product.js` (new file)

**Route:** `GET /product/:sku`
- Extract SKU from URL parameter
- Fetch product using `getProductBySku()`
- Return 404 if product not found
- Fetch categories for product's manufacturer (for sidebar)
- Render `product.ejs` template
- Pass product data and categories

### 3. Product Detail View

**File**: `src/views/product.ejs` (new file)

**Layout:** Two-column grid
1. **Left Column** - Product images
   - Main product image (or placeholder)
   - Sticky positioning (stays visible when scrolling)

2. **Right Column** - Product information
   - Manufacturer name
   - Product name (h1)
   - Variant name (if exists)
   - SKU and manufacturer number
   - Full HTML description
   - "More products from {manufacturer}" button
   - Breadcrumb navigation

**Features:**
- Render sanitized HTML description
- Handle missing images gracefully
- Handle missing variant names (don't show "nan")
- Link back to manufacturer's products

### 4. Update Product Cards

**File**: `src/views/partials/product-card.ejs` (modify existing)

**Changes:**
- Ensure product card links work: `<a href="/product/<%= product.sku %>">`
- Links should be full card clickable
- Maintain existing styling

### 5. Navigation Enhancements

**Breadcrumbs:**
```
Home > Products > Brand X > Product Name
```

**Related Navigation:**
- "More products from {manufacturer}" button
- Categories sidebar (reuse from product listing)

### 6. Error Handling

**404 Page:**
- Create proper 404 page when product not found
- Suggest browsing by manufacturer
- Link back to all products
- Show search form

---

## Acceptance Criteria

- [ ] `/product/:sku` loads product detail page
- [ ] Product name, manufacturer, and SKU display correctly
- [ ] Product image displays (or placeholder if missing)
- [ ] Variant name displays only if present and not "nan"
- [ ] Manufacturer number displays if present
- [ ] HTML description renders correctly (sanitized)
- [ ] "More from {manufacturer}" button links to manufacturer filter
- [ ] Categories sidebar shows categories for product's manufacturer
- [ ] Clicking product card from listing navigates to detail page
- [ ] Invalid SKU shows 404 page with helpful message
- [ ] Inactive product shows 404
- [ ] Page is responsive (mobile and desktop)
- [ ] Images are sticky on desktop (stay visible when scrolling)
- [ ] No XSS vulnerabilities in description rendering

---

## Testing Scenarios

### 1. Valid Product
```bash
# Navigate to product detail
http://localhost:3000/product/TEST-001

# Should show:
- Product name and details
- Image or placeholder
- Full description
- Manufacturer link
- Categories sidebar
```

### 2. Product Without Variant
```bash
http://localhost:3000/product/TEST-001

# Should NOT show "nan" or empty variant field
```

### 3. Product Without Image
```bash
# Product with no image_url
# Should show placeholder image
```

### 4. Invalid SKU
```bash
http://localhost:3000/product/INVALID-SKU

# Should show 404 page with:
- "Product not found" message
- Link to all products
- Search form
```

### 5. Navigation Flow
```bash
# From listing to detail
/products → Click product card → /product/SKU

# From detail back to manufacturer
/product/SKU → Click "More from X" → /products?manufacturer=X
```

### 6. HTML Description Rendering
```bash
# Product with HTML description
# Should render:
- <p> tags as paragraphs
- <ul> and <li> as lists
- <b> and <strong> as bold
- Properly sanitized (no <script> tags)
```

---

## Files to Create/Modify

### New Files
1. `/src/routes/product.js` - Product detail route
2. `/src/views/product.ejs` - Product detail template

### Modified Files
1. `/src/models/product.js` - Add `getProductBySku()`
2. `/src/app.js` - Mount product routes
3. `/src/views/partials/product-card.ejs` - Ensure links work
4. `/public/style.css` - Add product detail styles

---

## Template Structure

### product.ejs Layout
```ejs
<article class="product-detail">
  <div class="product-images">
    <!-- Sticky product image -->
  </div>

  <div class="product-info">
    <p class="manufacturer"><!-- Manufacturer --></p>
    <h1><!-- Product Name --></h1>
    <p class="variant"><!-- Variant if exists --></p>
    <p class="sku">Artikelnummer: <!-- SKU --></p>
    <p class="manufacturer-number">Herstellernummer: <!-- MFR# --></p>

    <div class="description">
      <%- product.description %>
    </div>

    <a href="/products?manufacturer=..." class="btn">
      Weitere Produkte von <!-- Manufacturer -->
    </a>
  </div>
</article>
```

---

## CSS Styling Requirements

**Product Detail Styles:**
- Two-column grid on desktop (1fr 1fr)
- Single column on mobile
- Sticky image container on desktop
- Proper spacing and typography hierarchy
- Button styling for CTA
- Responsive image sizing
- Description typography (lists, paragraphs)

**Responsive Breakpoints:**
- Desktop: 768px+
- Mobile: <768px

---

## Security Considerations

**HTML Description Sanitization:**
- Descriptions are pre-sanitized during CSV import
- Use `<%- %>` to render HTML (unescaped)
- Verify no `<script>` tags can execute
- Only allow safe tags: p, ul, li, b, strong, i, em, h3

**SQL Injection:**
- Use parameterized query for SKU lookup
- Never concatenate user input

**404 Handling:**
- Don't expose database errors to users
- Generic "not found" message
- Log errors server-side

---

## User Experience Details

**Sticky Images:**
- On desktop, product image stays visible while scrolling
- Improves browsing experience for long descriptions

**Related Navigation:**
- Easy to find more products from same manufacturer
- Categories sidebar helps discover related items
- Breadcrumbs provide context

**Missing Data Handling:**
- Graceful handling of missing images (placeholder)
- Don't show "nan" or null values
- Only display fields that have real data

---

## Performance Considerations

**Image Loading:**
- Use placeholder.svg for missing images
- Consider lazy loading for future enhancement
- Proper alt text for accessibility

**Database Query:**
- Single query to fetch product
- Additional query for categories (cached in future)
- Use indexed SKU field for fast lookup

---

## Next Steps (Future Issues)

After this issue is resolved:
- ISSUE-006: Polish CSS and responsive design
- Future: Deployment setup (ISSUE-007)

---

## References

- Implementation spec: `docs/implementation specification.md` lines 474-509, 577-612
- EJS unescaped output: https://ejs.co/#docs (<%- %> syntax)
- Sanitize-html: https://www.npmjs.com/package/sanitize-html
