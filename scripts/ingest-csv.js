const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');

const execPromise = util.promisify(exec);

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
    console.log('\n============================================================');
    console.log('CSV Ingestion Service');
    console.log('============================================================');
    console.log(`Inbox: ${INBOX_DIR}`);
    console.log(`Done: ${DONE_DIR}`);
    console.log(`Failed: ${FAILED_DIR}\n`);

    const files = fs.readdirSync(INBOX_DIR)
        .filter(file => file.endsWith('.csv'))
        .map(file => path.join(INBOX_DIR, file));

    if (files.length === 0) {
        console.log('📭 No CSV files found in inbox');
        console.log('   Drop CSV files in data/inbox/ to process them');
        console.log('============================================================\n');
        return;
    }

    console.log(`📦 Found ${files.length} file(s) to process\n`);

    for (const filePath of files) {
        await processFile(filePath);
    }

    console.log('\n============================================================');
    console.log('✅ Ingestion Complete');
    console.log('============================================================\n');
}

/**
 * Process a single CSV file
 */
async function processFile(filePath) {
    const filename = path.basename(filePath);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace(/Z$/, '');

    console.log(`\n📄 Processing: ${filename}`);
    console.log(`   Started: ${new Date().toLocaleString()}`);

    const startTime = Date.now();

    try {
        // Run import-csv.js as subprocess to keep it isolated
        const importScript = path.join(__dirname, 'import-csv.js');
        const { stdout, stderr } = await execPromise(`node "${importScript}" "${filePath}"`);

        // Display import output
        if (stdout) {
            console.log(stdout);
        }

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

        // Move to done folder with timestamp
        const doneFilename = `${timestamp}_${filename}`;
        const donePath = path.join(DONE_DIR, doneFilename);
        fs.renameSync(filePath, donePath);

        console.log(`✅ Success: Moved to done/${doneFilename}`);
        console.log(`   Duration: ${duration}s`);

        // Write import log
        const logPath = path.join(DONE_DIR, `${timestamp}_${filename}.log`);
        fs.writeFileSync(logPath, JSON.stringify({
            filename,
            processedAt: new Date().toISOString(),
            durationSeconds: parseFloat(duration),
            status: 'success',
            output: stdout
        }, null, 2));

    } catch (error) {
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

        console.error(`\n❌ Failed: ${error.message}`);
        console.error(`   Duration: ${duration}s`);

        // Move to failed folder for investigation
        const failedFilename = `${timestamp}_${filename}`;
        const failedPath = path.join(FAILED_DIR, failedFilename);
        fs.renameSync(filePath, failedPath);

        // Write error log
        const errorLogPath = path.join(FAILED_DIR, `${timestamp}_${filename}.error.log`);
        fs.writeFileSync(errorLogPath, JSON.stringify({
            filename,
            processedAt: new Date().toISOString(),
            durationSeconds: parseFloat(duration),
            status: 'failed',
            error: error.message,
            stderr: error.stderr,
            stdout: error.stdout,
            stack: error.stack
        }, null, 2));

        console.log(`📋 Error log: failed/${failedFilename}.error.log`);
        console.log(`📁 Failed file: failed/${failedFilename}`);
        console.log(`\n   To retry:`);
        console.log(`   1. Fix the CSV file in data/failed/`);
        console.log(`   2. Move it back to data/inbox/`);
        console.log(`   3. Run npm run ingest again`);
    }
}

// Run if called directly
if (require.main === module) {
    ingestAllCSVs()
        .then(() => process.exit(0))
        .catch(err => {
            console.error('\n============================================================');
            console.error('✗ Ingestion Service Error');
            console.error('============================================================');
            console.error(err.message);
            console.error('============================================================\n');
            process.exit(1);
        });
}

module.exports = { ingestAllCSVs, processFile };
