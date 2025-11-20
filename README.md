# IDS PIM Ingress - Dental Product Catalog Extraction

**Status**: Starting implementation

## Overview

A searchable dental product catalog with manufacturer filtering, full-text search, and product detail pages - starting as a functional skeleton (working in 1 day) before layering on Figma designs.

## Tech Stack

- **Database**: PostgreSQL (with pg_trgm for full-text search)
- **Backend**: Node.js + Express
- **Templating**: EJS
- **Styling**: Plain CSS (no framework)
- **Key Libraries**: pg, csv-parse, sanitize-html, helmet, compression
- **Deployment**: Railway (PostgreSQL + Web service)

## Project Structure

```
/
├── docs/
│   └── implementation specification.md
│   ├── issues/
│   ├── decisions/
├── src/
│   ├── config/
│   │   └── database.js
│   ├── models/
│   │   └── product.js
│   ├── routes/
│   │   ├── products.js
│   │   └── product.js
│   ├── views/
│   │   ├── layout.ejs
│   │   ├── products.ejs
│   │   ├── product.ejs
│   │   └── partials/
│   │       ├── header.ejs
│   │       ├── footer.ejs
│   │       ├── sidebar.ejs
│   │       ├── product-card.ejs
│   │       └── pagination.ejs
│   └── app.js
├── public/
│   ├── style.css
│   └── images/
│       ├── logo.svg
│       └── placeholder.svg
├── scripts/
│   ├── schema.sql
│   └── import-csv.js
├── .env
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

## Quick Start

```bash

```

## Documentation

- **Current Session**: See `current-session.md` for latest status (if not, create)
- **Working with Claude**: See `docs/working-with-claude.md` for LLM collaboration guide
- **Issues**: See `docs/issues/` for tracked work
- **Decisions/ADRs**: See `docs/decisions/` for ADRs
- **Lessons Learned**: See `docs/lessons-learned.md` for gotchas
