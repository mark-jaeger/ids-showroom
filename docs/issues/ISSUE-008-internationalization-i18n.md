# ISSUE-008: Internationalization (i18n) - UI String Translation

**Status**: Pending
**Date**: 2024-11-20
**Type**: Enhancement - Internationalization
**Component**: Backend, Views, Frontend
**Assignee**: Claude Code
**Depends On**: ISSUE-005
**Priority**: Medium

---

## Objective

Implement internationalization (i18n) support to translate all UI strings, enabling multi-language support. Start with German (current) and English, with the ability to add more languages in the future.

---

## Current State

All UI strings are hardcoded in German:
- "Suchen" (Search)
- "Produkte" (Products)
- "Artikelnummer" (Article Number)
- "Herstellernummer" (Manufacturer Number)
- "Weitere Produkte von..." (More products from...)
- etc.

---

## Proposed Solution

Implement i18n using **i18next** with Express middleware, supporting:
- Multiple languages (German, English, expandable)
- Language detection from URL, cookies, or browser headers
- Translation files in JSON format
- Template helper functions for translations

---

## Supported Languages

**Phase 1 (Initial Implementation):**
1. **German (de)** - Default language
2. **English (en)** - Secondary language

**Phase 2 (Future):**
- French (fr)
- Spanish (es)
- Italian (it)
- Polish (pl)

---

## URL Structure for Languages

### Option A: Language in URL Path (Recommended)
```
/de/products
/en/products
/de/product/spiegel/dentalspiegel-5/TEST-001
/en/product/mirrors/dental-mirror-5/TEST-001

Default (no language): /products → redirects to /de/products
```

### Option B: Language Subdomain
```
de.dental-catalog.com
en.dental-catalog.com
```

### Option C: Query Parameter
```
/products?lang=de
/products?lang=en
```

**Recommendation: Use Option A (URL path)**
- Best for SEO (separate URLs per language)
- Clean, professional URLs
- Easy to implement with Express routing

---

## Implementation Plan

### 1. Install i18next Dependencies

```bash
npm install i18next i18next-http-middleware i18next-fs-backend
```

**Packages:**
- `i18next` - Core i18n library
- `i18next-http-middleware` - Express middleware
- `i18next-fs-backend` - Load translations from JSON files

### 2. Create Translation Files

**Directory Structure:**
```
/locales
  /de
    translation.json
  /en
    translation.json
```

**File:** `/locales/de/translation.json`
```json
{
  "header": {
    "logo_alt": "Dental Katalog",
    "search_placeholder": "Produkt suchen...",
    "search_button": "Suchen"
  },
  "navigation": {
    "home": "Home",
    "products": "Produkte",
    "all_products": "Alle Produkte",
    "all_manufacturers": "Alle Hersteller"
  },
  "product": {
    "sku": "Artikelnummer",
    "manufacturer_number": "Herstellernummer",
    "variant": "Variante",
    "more_from": "Weitere Produkte von {{manufacturer}}",
    "not_found": "Produkt nicht gefunden",
    "not_found_message": "Das gesuchte Produkt konnte nicht gefunden werden."
  },
  "listing": {
    "result_count": "{{count}} Produkte",
    "clear_filters": "Filter zurücksetzen",
    "no_results": "Keine Produkte gefunden.",
    "manufacturers": "Hersteller",
    "categories": "Kategorien"
  },
  "pagination": {
    "previous": "Zurück",
    "next": "Weiter",
    "page_info": "Seite {{current}} von {{total}}"
  },
  "error": {
    "page_not_found": "Seite nicht gefunden",
    "server_error": "Serverfehler",
    "suggestions": "Vorschläge:",
    "suggestion_search": "Verwenden Sie die Suchfunktion, um nach ähnlichen Produkten zu suchen",
    "suggestion_browse": "Stöbern Sie durch unsere Herstellerkategorien",
    "suggestion_return": "Kehren Sie zur Übersicht zurück und filtern Sie nach Ihren Bedürfnissen"
  },
  "breadcrumb": {
    "home": "Home",
    "products": "Produkte"
  },
  "footer": {
    "copyright": "© 2024 Dental Katalog. Alle Rechte vorbehalten."
  }
}
```

**File:** `/locales/en/translation.json`
```json
{
  "header": {
    "logo_alt": "Dental Catalog",
    "search_placeholder": "Search products...",
    "search_button": "Search"
  },
  "navigation": {
    "home": "Home",
    "products": "Products",
    "all_products": "All Products",
    "all_manufacturers": "All Manufacturers"
  },
  "product": {
    "sku": "Article Number",
    "manufacturer_number": "Manufacturer Number",
    "variant": "Variant",
    "more_from": "More products from {{manufacturer}}",
    "not_found": "Product Not Found",
    "not_found_message": "The requested product could not be found."
  },
  "listing": {
    "result_count": "{{count}} Products",
    "clear_filters": "Clear Filters",
    "no_results": "No products found.",
    "manufacturers": "Manufacturers",
    "categories": "Categories"
  },
  "pagination": {
    "previous": "Previous",
    "next": "Next",
    "page_info": "Page {{current}} of {{total}}"
  },
  "error": {
    "page_not_found": "Page Not Found",
    "server_error": "Server Error",
    "suggestions": "Suggestions:",
    "suggestion_search": "Use the search function to find similar products",
    "suggestion_browse": "Browse through our manufacturer categories",
    "suggestion_return": "Return to the overview and filter according to your needs"
  },
  "breadcrumb": {
    "home": "Home",
    "products": "Products"
  },
  "footer": {
    "copyright": "© 2024 Dental Catalog. All rights reserved."
  }
}
```

### 3. Configure i18next

**File:** `src/config/i18n.js` (new file)

```javascript
const i18next = require('i18next');
const Backend = require('i18next-fs-backend');
const middleware = require('i18next-http-middleware');
const path = require('path');

i18next
  .use(Backend)
  .use(middleware.LanguageDetector)
  .init({
    backend: {
      loadPath: path.join(__dirname, '../../locales/{{lng}}/{{ns}}.json')
    },
    fallbackLng: 'de',
    supportedLngs: ['de', 'en'],
    preload: ['de', 'en'],
    ns: ['translation'],
    defaultNS: 'translation',
    detection: {
      order: ['path', 'cookie', 'header'],
      lookupPath: 'lng',
      lookupCookie: 'language',
      caches: ['cookie']
    },
    interpolation: {
      escapeValue: false // Not needed for server-side
    }
  });

module.exports = i18next;
```

### 4. Add i18n Middleware to Express

**File:** `src/app.js` (modify)

```javascript
const i18next = require('./config/i18n');
const i18nextMiddleware = require('i18next-http-middleware');

// i18n middleware (add before routes)
app.use(i18nextMiddleware.handle(i18next));

// Make translation function available in templates
app.use((req, res, next) => {
    res.locals.t = req.t;
    res.locals.lng = req.language;
    next();
});
```

### 5. Update Routes for Language Prefix

**File:** `src/routes/products.js` (modify)

Add language prefix to all routes:
```javascript
// Language-aware routes
router.get('/:lng/products', async (req, res) => { ... });
router.get('/:lng/', (req, res) => { ... });

// Redirect root to default language
router.get('/', (req, res) => {
    res.redirect('/de/products');
});
```

**File:** `src/routes/product.js` (modify)

```javascript
router.get('/:lng/product/:sku', async (req, res) => { ... });
```

### 6. Update Templates to Use Translations

**File:** `src/views/partials/header.ejs` (modify)

```ejs
<!-- Before -->
<input type="search" placeholder="Produkt suchen..." />
<button>Suchen</button>

<!-- After -->
<input type="search" placeholder="<%= t('header.search_placeholder') %>" />
<button><%= t('header.search_button') %></button>
```

**File:** `src/views/product.ejs` (modify)

```ejs
<!-- Before -->
<p class="product-sku">Artikelnummer: <strong><%= product.sku %></strong></p>

<!-- After -->
<p class="product-sku"><%= t('product.sku') %>: <strong><%= product.sku %></strong></p>
```

**File:** `src/views/products.ejs` (modify)

```ejs
<!-- Before -->
<p class="result-count"><%= pagination.totalCount.toLocaleString('de-DE') %> Produkte</p>

<!-- After -->
<p class="result-count"><%= t('listing.result_count', { count: pagination.totalCount.toLocaleString(lng) }) %></p>
```

### 7. Add Language Switcher

**File:** `src/views/partials/language-switcher.ejs` (new file)

```ejs
<div class="language-switcher">
    <% const currentPath = req.path.replace(/^\/(de|en)/, ''); %>
    <a href="/de<%= currentPath %>" class="<%= lng === 'de' ? 'active' : '' %>">DE</a>
    <a href="/en<%= currentPath %>" class="<%= lng === 'en' ? 'active' : '' %>">EN</a>
</div>
```

**Include in header:**
```ejs
<%- include('partials/language-switcher') %>
```

### 8. Add Language Switcher Styles

**File:** `public/style.css` (add)

```css
/* Language Switcher */
.language-switcher {
    display: flex;
    gap: 0.5rem;
    margin-left: auto;
}

.language-switcher a {
    padding: 0.5rem 0.75rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 0.9rem;
    color: #666;
    text-decoration: none;
}

.language-switcher a:hover {
    background: #f0f0f0;
}

.language-switcher a.active {
    background: #0066cc;
    color: white;
    border-color: #0066cc;
}
```

---

## Product Data Translation

### Database Schema Enhancement

**Option A: Separate Translation Tables**
```sql
CREATE TABLE product_translations (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id),
    language VARCHAR(2),
    name TEXT,
    description TEXT,
    variant_name TEXT,
    UNIQUE(product_id, language)
);
```

**Option B: JSON Column**
```sql
ALTER TABLE products ADD COLUMN translations JSONB;

-- Example data:
{
  "de": {
    "name": "Dentalspiegel #5",
    "description": "Hochwertiger Dentalspiegel..."
  },
  "en": {
    "name": "Dental Mirror #5",
    "description": "High-quality dental mirror..."
  }
}
```

**Option C: No Translation (Phase 1)**
- Keep product data in German only
- Translate UI strings only
- Add product translation in Phase 2

**Recommendation: Use Option C for Phase 1**
- Simpler initial implementation
- Product names often stay in original language
- Can add product translation later

---

## URL Translation Consideration

If implementing ISSUE-007 (SEO URLs) with i18n:

```
German:  /de/product/spiegel/dentalspiegel-5/TEST-001
English: /en/product/mirrors/dental-mirror-5/TEST-001
         (translates both category and product name)
```

This requires:
- Translated category slugs
- Translated product name slugs
- More complex but better SEO

For Phase 1, consider keeping slugs in German:
```
German:  /de/product/spiegel/dentalspiegel-5/TEST-001
English: /en/product/spiegel/dentalspiegel-5/TEST-001
         (same slug, different UI language)
```

---

## Acceptance Criteria

- [ ] i18next installed and configured
- [ ] Translation files created for DE and EN
- [ ] All UI strings use `t()` function
- [ ] Language prefix added to all routes
- [ ] Language detection works from URL path
- [ ] Language switcher appears in header
- [ ] Active language highlighted in switcher
- [ ] Switching language preserves current page context
- [ ] Default language (DE) used when no language specified
- [ ] Translation interpolation works (e.g., "{{count}} Products")
- [ ] Pluralization handled correctly
- [ ] Date/number formatting uses locale
- [ ] All templates updated to use translations
- [ ] No hardcoded strings remain in templates
- [ ] SEO meta tags include language attribute

---

## Files to Create/Modify

### New Files
1. `/locales/de/translation.json` - German translations
2. `/locales/en/translation.json` - English translations
3. `/src/config/i18n.js` - i18next configuration
4. `/src/views/partials/language-switcher.ejs` - Language switcher component

### Modified Files
1. `/src/app.js` - Add i18n middleware
2. `/src/routes/products.js` - Add language prefix to routes
3. `/src/routes/product.js` - Add language prefix to routes
4. `/src/views/partials/header.ejs` - Use translations
5. `/src/views/partials/sidebar.ejs` - Use translations
6. `/src/views/partials/footer.ejs` - Use translations
7. `/src/views/products.ejs` - Use translations
8. `/src/views/product.ejs` - Use translations
9. `/src/views/404.ejs` - Use translations
10. `/public/style.css` - Add language switcher styles
11. `/package.json` - Add i18next dependencies

---

## Testing Scenarios

### 1. Language Detection
```bash
# Default language (no prefix)
http://localhost:3000/products
→ Redirects to: /de/products

# German explicit
http://localhost:3000/de/products
→ Shows German UI

# English explicit
http://localhost:3000/en/products
→ Shows English UI
```

### 2. Language Switcher
```bash
# On German product page
/de/product/TEST-001
→ Click "EN" → /en/product/TEST-001

# On English listing page
/en/products?search=mirror
→ Click "DE" → /de/products?search=mirror
```

### 3. Translation Keys
```bash
# All UI strings translated
- Search button says "Suchen" (DE) / "Search" (EN)
- SKU label says "Artikelnummer" (DE) / "Article Number" (EN)
- Pagination says "Seite X von Y" (DE) / "Page X of Y" (EN)
```

### 4. Interpolation
```bash
# Dynamic values in translations
"5 Produkte" (DE) / "5 Products" (EN)
"Weitere Produkte von Brand X" (DE) / "More products from Brand X" (EN)
```

### 5. Fallback Behavior
```bash
# Unsupported language
http://localhost:3000/fr/products
→ Fallback to DE or show error
```

---

## SEO Considerations

### hreflang Tags

Add alternate language links to `<head>`:
```html
<link rel="alternate" hreflang="de" href="https://example.com/de/products" />
<link rel="alternate" hreflang="en" href="https://example.com/en/products" />
<link rel="alternate" hreflang="x-default" href="https://example.com/de/products" />
```

### Language in HTML Tag
```html
<html lang="<%= lng %>">
```

### Sitemap per Language
```xml
/sitemap-de.xml
/sitemap-en.xml
```

---

## Performance Considerations

- Load all translations at startup (preload)
- Cache translations in memory
- Minimal overhead per request
- Consider CDN for static translation files

---

## Future Enhancements

1. **Admin Interface for Translations**
   - Edit translations without touching JSON files
   - Non-technical users can update strings

2. **Product Data Translation**
   - Translate product names and descriptions
   - Per-language slugs for SEO

3. **Regional Number/Date Formats**
   - EUR vs USD currency
   - DD.MM.YYYY vs MM/DD/YYYY dates

4. **Translation Management Service**
   - Integrate with Lokalise, Crowdin, or POEditor
   - Professional translation workflow

5. **Language-Specific Content**
   - Different catalogs per region
   - Region-specific pricing

---

## Implementation Order

1. Install i18next dependencies
2. Create i18n configuration file
3. Create translation JSON files (DE, EN)
4. Add i18n middleware to Express
5. Update routes to support language prefix
6. Update all templates to use `t()` function
7. Create and integrate language switcher
8. Add CSS for language switcher
9. Test all pages in both languages
10. Add SEO tags (hreflang, lang attribute)
11. Verify no hardcoded strings remain

---

## References

- i18next Documentation: https://www.i18next.com/
- i18next Express Middleware: https://github.com/i18next/i18next-http-middleware
- Google i18n Best Practices: https://developers.google.com/search/docs/specialty/international
- hreflang Tags: https://developers.google.com/search/docs/specialty/international/localized-versions
