# ISSUE-003: Express App Setup + Basic Product Listing

**Status**: ✅ RESOLVED
**Date**: 2024-11-20
**Type**: Feature - Phase 3
**Component**: Backend, Routes, Views
**Assignee**: Claude Code
**Depends On**: ISSUE-001, ISSUE-002

---

## Objective

Set up the Express application with basic product listing functionality. Display all products in a simple list without search or filtering.

---

## Scope

This is Phase 3 of the incremental implementation. Build the application foundation with a single working route that displays products from the database (imported via ISSUE-002).

**Deliverables:**
1. Express application entry point (`src/app.js`)
2. Products route handler (`src/routes/products.js`)
3. Product model with basic queries (`src/models/product.js`)
4. EJS layout and product listing view
5. Basic CSS for readable layout
6. Working `/products` endpoint

---

## Implementation Plan

### 1. Express Application Setup

**File**: `src/app.js`
- Initialize Express with middleware (helmet, compression, body-parser)
- Configure EJS as view engine
- Set up static file serving for `/public`
- Mount routes
- Add basic error handling (404, 500)
- Start server on PORT from environment

### 2. Product Model

**File**: `src/models/product.js`
- Create `getAllProducts({ page, limit })` function
- Return paginated products ordered by name
- Include total count for pagination
- Use connection pool from `src/config/database.js`

### 3. Products Route

**File**: `src/routes/products.js`
- GET `/products` - Display all products (paginated)
- GET `/` - Redirect to `/products`
- Extract page number from query params
- Render `products.ejs` template
- Handle errors gracefully

### 4. Views Structure

**Files**:
- `src/views/layout.ejs` - Base HTML layout
- `src/views/products.ejs` - Product listing page
- `src/views/partials/header.ejs` - Header (logo, search placeholder)
- `src/views/partials/footer.ejs` - Footer
- `src/views/partials/product-card.ejs` - Product grid item
- `src/views/partials/pagination.ejs` - Pagination controls

**Note**: Search form in header will be non-functional placeholder for now

### 5. Basic Styling

**File**: `public/style.css`
- CSS reset and base styles
- Container and grid layout
- Header and footer styling
- Product card styling
- Pagination styling
- Mobile-responsive grid
- No fancy effects yet (skeleton only)

### 6. Placeholder Assets

**Files**:
- `public/images/logo.svg` - Simple text-based logo
- `public/images/placeholder.svg` - Product image placeholder

---

## Acceptance Criteria

- [ ] Express server starts successfully on configured PORT
- [ ] GET `/` redirects to `/products`
- [ ] GET `/products` displays all products in grid layout
- [ ] Products show: image, manufacturer, name, variant, SKU
- [ ] Product cards are clickable (href to `/product/:sku` - will 404 for now)
- [ ] Pagination controls appear when products > 48
- [ ] Page numbers work correctly (?page=2, ?page=3, etc.)
- [ ] Header renders with logo and search placeholder
- [ ] Footer renders
- [ ] CSS makes page readable and functional
- [ ] No console errors in browser or server
- [ ] Works on mobile and desktop viewports

---

## Testing Steps

```bash
# 1. Install dependencies
npm install

# 2. Start development server
npm run dev

# 3. Open browser
open http://localhost:3000

# 4. Verify products display
# - Should see grid of products
# - Should see pagination if >48 products
# - Click product card (will 404 - expected)

# 5. Test pagination
# Navigate to http://localhost:3000/products?page=2
# Should see different products

# 6. Test mobile view
# Resize browser to mobile width
# Grid should adapt responsively
```

---

## Files to Create

### New Files
1. `/src/app.js` - Express application
2. `/src/models/product.js` - Product model (partial - just getAllProducts)
3. `/src/routes/products.js` - Products routes
4. `/src/views/layout.ejs` - Base layout
5. `/src/views/products.ejs` - Product listing page
6. `/src/views/partials/header.ejs` - Header partial
7. `/src/views/partials/footer.ejs` - Footer partial
8. `/src/views/partials/product-card.ejs` - Product card partial
9. `/src/views/partials/pagination.ejs` - Pagination partial
10. `/public/style.css` - Main stylesheet
11. `/public/images/logo.svg` - Logo placeholder
12. `/public/images/placeholder.svg` - Product image placeholder

### Modified Files
1. `/package.json` - Add Express dependencies
2. `/.gitignore` - Add node_modules, .env

---

## Dependencies to Add

```json
{
  "dependencies": {
    "express": "^4.18.0",
    "pg": "^8.11.0",
    "ejs": "^3.1.9",
    "dotenv": "^16.3.0",
    "helmet": "^7.1.0",
    "compression": "^1.7.4"
  },
  "devDependencies": {
    "nodemon": "^3.0.0"
  },
  "scripts": {
    "start": "node src/app.js",
    "dev": "nodemon src/app.js"
  }
}
```

---

## Technical Notes

- Use EJS for server-side rendering (simpler than React for this use case)
- Product cards link to `/product/:sku` even though route doesn't exist yet
- Search form in header is visual placeholder (no action yet)
- Sidebar will be empty for now (added in Phase 3)
- Follow specification CSS closely for consistency
- Use semantic HTML for accessibility
- Pagination should preserve query params (important for Phase 3)

---

## Design Constraints

**Keep it simple:**
- Plain CSS, no framework
- Minimal JavaScript (none for now)
- Server-side rendering only
- Basic responsive grid
- No loading states yet
- No error pages yet (just text)

---

## Next Steps (Future Issues)

After this issue is resolved:
- ISSUE-004: Add search functionality
- ISSUE-005: Add product detail pages
- ISSUE-006: Polish CSS and responsive design

---

## References

- Implementation spec: `docs/implementation specification.md` lines 182-509
- Express docs: https://expressjs.com/
- EJS docs: https://ejs.co/
