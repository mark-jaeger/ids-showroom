# ISSUE-010: Automated CSV Ingestion System

**Status**: Pending
**Date**: 2024-11-21
**Type**: Enhancement - Data Import
**Component**: Backend, Scripts
**Assignee**: Claude Code
**Depends On**: ISSUE-009
**Priority**: Medium

---

## Objective

Create an automated CSV ingestion system that monitors a folder for new product CSV files, imports them automatically, and maintains a history of processed files without bloating the git repository.

---

## Current State

**Current CSV Import Process:**
- Manual: `npm run import-data` with hardcoded file path
- File path in package.json: `data/2025_06_04_scraping_products.csv`
- No tracking of what's been imported
- Large CSV files committed to repository (43MB)
- No automation or file history

**Problems:**
- Manual process requires code changes for new files
- Can't easily re-import or process multiple files
- No audit trail of imports
- Git repository bloated with large CSV files
- No way to know if a file was already processed

---

## Proposed Solution

Create an automated ingestion system that:
1. **Watches** a `data/inbox/` folder for new CSV files
2. **Processes** each file automatically
3. **Moves** completed files to `data/done/` with timestamp
4. **Tracks** import history and prevents duplicate imports
5. **Excludes** processed files from git repository

---

## Implementation Plan

### 1. Directory Structure

```
data/
├── inbox/          # Drop new CSV files here (not in git)
├── done/           # Completed imports (not in git)
├── failed/         # Failed imports for review (not in git)
└── sample.csv      # Example file (in git)
```

### 2. Update .gitignore

**File:** `.gitignore` (modify)

```
# Data folders
data/inbox/
data/done/
data/failed/
data/*.csv
!data/sample.csv
```

**Keep in Git:**
- `data/sample.csv` - Example/template file
- Empty `.gitkeep` files for folder structure

**Exclude from Git:**
- All CSV files in data/ (except sample)
- All processed files in done/
- All failed files in failed/

### 3. Create Ingestion Script

**File:** `scripts/ingest-csv.js` (new file)

```javascript
const fs = require('fs');
const path = require('path');
const importCSV = require('./import-csv');

const INBOX_DIR = path.join(__dirname, '../data/inbox');
const DONE_DIR = path.join(__dirname, '../data/done');
const FAILED_DIR = path.join(__dirname, '../data/failed');

// Ensure directories exist
[INBOX_DIR, DONE_DIR, FAILED_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

/**
 * Process all CSV files in inbox folder
 */
async function ingestAllCSVs() {
    console.log('🔍 Checking inbox for CSV files...');

    const files = fs.readdirSync(INBOX_DIR)
        .filter(file => file.endsWith('.csv'))
        .map(file => path.join(INBOX_DIR, file));

    if (files.length === 0) {
        console.log('📭 No CSV files found in inbox');
        return;
    }

    console.log(`📦 Found ${files.length} file(s) to process`);

    for (const filePath of files) {
        await processFile(filePath);
    }

    console.log('✅ Ingestion complete');
}

/**
 * Process a single CSV file
 */
async function processFile(filePath) {
    const filename = path.basename(filePath);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    console.log(`\n📄 Processing: ${filename}`);
    console.log(`   Started: ${new Date().toLocaleString()}`);

    try {
        // Import the CSV (reuse existing import-csv.js logic)
        await importCSV(filePath);

        // Move to done folder with timestamp
        const doneFilename = `${timestamp}_${filename}`;
        const donePath = path.join(DONE_DIR, doneFilename);
        fs.renameSync(filePath, donePath);

        console.log(`✅ Success: Moved to done/${doneFilename}`);

        // Write import log
        const logPath = path.join(DONE_DIR, `${timestamp}_${filename}.log`);
        fs.writeFileSync(logPath, JSON.stringify({
            filename,
            processedAt: new Date().toISOString(),
            status: 'success'
        }, null, 2));

    } catch (error) {
        console.error(`❌ Failed: ${error.message}`);

        // Move to failed folder for investigation
        const failedFilename = `${timestamp}_${filename}`;
        const failedPath = path.join(FAILED_DIR, failedFilename);
        fs.renameSync(filePath, failedPath);

        // Write error log
        const errorLogPath = path.join(FAILED_DIR, `${timestamp}_${filename}.error.log`);
        fs.writeFileSync(errorLogPath, JSON.stringify({
            filename,
            processedAt: new Date().toISOString(),
            status: 'failed',
            error: error.message,
            stack: error.stack
        }, null, 2));

        console.log(`📋 Error log: failed/${failedFilename}.error.log`);
    }
}

// Run if called directly
if (require.main === module) {
    ingestAllCSVs()
        .then(() => process.exit(0))
        .catch(err => {
            console.error(err);
            process.exit(1);
        });
}

module.exports = { ingestAllCSVs, processFile };
```

### 4. Refactor import-csv.js

**File:** `scripts/import-csv.js` (modify)

Make it export a function that can be called by ingest-csv.js:

```javascript
async function importCSVFile(csvPath) {
    // Existing import logic
    // Return import statistics
    return {
        totalRows: count,
        imported: successCount,
        skipped: skipCount,
        errors: errorCount
    };
}

// Support both CLI and programmatic usage
if (require.main === module) {
    const csvPath = process.argv[2];
    if (!csvPath) {
        console.error('Usage: node import-csv.js <path-to-csv>');
        process.exit(1);
    }
    importCSVFile(csvPath)
        .then(() => process.exit(0))
        .catch(err => {
            console.error(err);
            process.exit(1);
        });
}

module.exports = importCSVFile;
```

### 5. Add Watch Mode (Optional)

**File:** `scripts/watch-inbox.js` (new file)

```javascript
const chokidar = require('chokidar');
const { processFile } = require('./ingest-csv');
const path = require('path');

const INBOX_DIR = path.join(__dirname, '../data/inbox');

console.log(`👀 Watching ${INBOX_DIR} for new CSV files...`);
console.log('   Press Ctrl+C to stop');

const watcher = chokidar.watch(INBOX_DIR, {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 100
    }
});

watcher.on('add', async (filePath) => {
    if (filePath.endsWith('.csv')) {
        console.log(`\n📥 New file detected: ${path.basename(filePath)}`);
        await processFile(filePath);
    }
});

watcher.on('error', error => {
    console.error('❌ Watcher error:', error);
});
```

**Install chokidar:**
```bash
npm install chokidar --save-dev
```

### 6. Update package.json Scripts

**File:** `package.json` (modify)

```json
{
  "scripts": {
    "start": "node src/app.js",
    "dev": "nodemon src/app.js",
    "setup-db": "node scripts/setup-database.js",
    "import-csv": "node scripts/import-csv.js",
    "ingest": "node scripts/ingest-csv.js",
    "watch-inbox": "node scripts/watch-inbox.js",
    "deploy": "sh scripts/deploy-railway.sh",
    "test": "echo \"No tests configured yet\" && exit 0"
  }
}
```

### 7. Create Directory Structure with .gitkeep

**File:** `data/inbox/.gitkeep` (new file)
```
# Drop new CSV files here for automatic processing
```

**File:** `data/done/.gitkeep` (new file)
```
# Successfully processed CSV files (excluded from git)
```

**File:** `data/failed/.gitkeep` (new file)
```
# Failed CSV files for investigation (excluded from git)
```

### 8. Add Import History View (Optional)

**File:** `scripts/import-history.js` (new file)

```javascript
const fs = require('fs');
const path = require('path');

const DONE_DIR = path.join(__dirname, '../data/done');

console.log('📜 Import History\n');

const logs = fs.readdirSync(DONE_DIR)
    .filter(file => file.endsWith('.log'))
    .map(file => {
        const content = fs.readFileSync(path.join(DONE_DIR, file), 'utf8');
        return JSON.parse(content);
    })
    .sort((a, b) => new Date(b.processedAt) - new Date(a.processedAt));

logs.forEach(log => {
    const date = new Date(log.processedAt).toLocaleString();
    const status = log.status === 'success' ? '✅' : '❌';
    console.log(`${status} ${log.filename}`);
    console.log(`   ${date}`);
    console.log('');
});

console.log(`Total imports: ${logs.length}`);
```

---

## Usage Examples

### Manual Ingestion

```bash
# 1. Drop CSV files into data/inbox/
cp new-products-2024-11.csv data/inbox/

# 2. Run ingestion
npm run ingest

# 3. Check results
ls data/done/    # Successfully processed
ls data/failed/  # Failed imports
```

### Automated Watch Mode

```bash
# Start watching inbox folder
npm run watch-inbox

# Drop files into inbox - they'll be processed automatically
cp products.csv data/inbox/
# -> Automatically imported and moved to done/
```

### View Import History

```bash
npm run import-history

# Output:
# 📜 Import History
#
# ✅ 2024-11-21_products.csv
#    11/21/2024, 10:30:45 AM
#
# ✅ 2024-11-20_catalog.csv
#    11/20/2024, 3:15:22 PM
```

---

## File Naming Convention

**Processed Files:**
```
done/2024-11-21T10-30-45-123Z_products.csv
done/2024-11-21T10-30-45-123Z_products.csv.log
```

**Failed Files:**
```
failed/2024-11-21T10-30-45-123Z_products.csv
failed/2024-11-21T10-30-45-123Z_products.csv.error.log
```

---

## Acceptance Criteria

- [ ] `data/inbox/`, `data/done/`, `data/failed/` folders created
- [ ] `.gitignore` excludes large CSV files and processed data
- [ ] `.gitkeep` files maintain folder structure in git
- [ ] `ingest-csv.js` processes all files in inbox
- [ ] Successfully imported files moved to `done/` with timestamp
- [ ] Failed imports moved to `failed/` with error log
- [ ] Import logs written for audit trail
- [ ] `import-csv.js` refactored to support both CLI and programmatic usage
- [ ] Watch mode (optional) monitors inbox for new files
- [ ] `npm run ingest` processes inbox folder
- [ ] `npm run watch-inbox` starts file watcher
- [ ] `npm run import-history` shows import history
- [ ] No large CSV files committed to repository
- [ ] Documentation updated with new workflow

---

## Benefits

### 1. **Automation**
- Drop files in inbox → automatic processing
- No code changes needed for new imports
- Watch mode for continuous ingestion

### 2. **Audit Trail**
- Complete history of imports
- Timestamped processed files
- Error logs for failed imports
- Easy to trace what was imported when

### 3. **Repository Health**
- Git repo stays small (no large CSVs)
- Processed files excluded from version control
- Only sample.csv in repository

### 4. **Error Handling**
- Failed imports isolated in failed/ folder
- Error logs help debug issues
- Failed files can be fixed and re-imported

### 5. **Production Ready**
- Can run on schedule (cron job)
- Can run as background service (watch mode)
- Suitable for Railway deployment

---

## Railway Deployment

### Environment Variable

```env
CSV_INBOX_PATH=/app/data/inbox
CSV_DONE_PATH=/app/data/done
CSV_FAILED_PATH=/app/data/failed
```

### Upload CSV to Railway

```bash
# Option 1: Railway CLI
railway run cp local-file.csv /app/data/inbox/

# Option 2: S3 bucket trigger
# Download from S3 → process → upload results

# Option 3: API endpoint
# POST /admin/import with CSV file upload
```

---

## Future Enhancements

### 1. REST API Endpoint

```javascript
POST /admin/import
Content-Type: multipart/form-data

{
  file: <csv-file>
}
```

### 2. Scheduled Imports

```javascript
// Cron job: every day at 2 AM
cron.schedule('0 2 * * *', () => {
    ingestAllCSVs();
});
```

### 3. Email Notifications

```javascript
// Send email on import completion
sendEmail({
    to: 'admin@ids.online',
    subject: 'CSV Import Complete',
    body: `Imported ${count} products`
});
```

### 4. S3 Integration

```javascript
// Watch S3 bucket for new files
// Download → Process → Archive to S3
```

### 5. Import Dashboard

```
/admin/imports
- List all imports
- View import stats
- Retry failed imports
- Download processed files
```

---

## Testing Scenarios

### 1. Single File Import

```bash
cp test-products.csv data/inbox/
npm run ingest
# Should move to done/ with timestamp
```

### 2. Multiple Files

```bash
cp file1.csv file2.csv file3.csv data/inbox/
npm run ingest
# Should process all files sequentially
```

### 3. Failed Import

```bash
# Create invalid CSV
echo "invalid,data" > data/inbox/bad.csv
npm run ingest
# Should move to failed/ with error log
```

### 4. Watch Mode

```bash
npm run watch-inbox
# In another terminal:
cp products.csv data/inbox/
# Should auto-process and move to done/
```

### 5. Import History

```bash
npm run import-history
# Should show list of all processed files
```

---

## Files to Create/Modify

### New Files
1. `scripts/ingest-csv.js` - Main ingestion script
2. `scripts/watch-inbox.js` - File watcher for automatic processing
3. `scripts/import-history.js` - View import history
4. `data/inbox/.gitkeep` - Maintain folder structure
5. `data/done/.gitkeep` - Maintain folder structure
6. `data/failed/.gitkeep` - Maintain folder structure

### Modified Files
1. `.gitignore` - Exclude CSV files and processed data
2. `scripts/import-csv.js` - Refactor to support programmatic usage
3. `package.json` - Add new npm scripts
4. `README.md` - Document new import workflow

---

## Migration from Current System

1. **Keep existing import-csv.js** - Still works for manual imports
2. **Add new ingest system** - Parallel to existing system
3. **Move large CSV** - `git rm data/2025_06_04_scraping_products.csv`
4. **Add to .gitignore** - Prevent future large files
5. **Update docs** - New import workflow

---

## References

- Node.js fs module: https://nodejs.org/api/fs.html
- Chokidar (file watcher): https://github.com/paulmillr/chokidar
- Git LFS (alternative for large files): https://git-lfs.github.com/
