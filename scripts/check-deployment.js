const https = require('https');

const urls = [
    'https://ngrdpxhz.up.railway.app',
    'https://catalog.ids.online'
];

let attempts = 0;
const maxAttempts = 12; // 2 minutes (12 * 10s)

function checkUrl(url) {
    return new Promise((resolve) => {
        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            port: 443,
            path: '/',
            method: 'HEAD',
            timeout: 5000
        };

        const req = https.request(options, (res) => {
            resolve({
                url,
                status: res.statusCode,
                success: res.statusCode >= 200 && res.statusCode < 400
            });
        });

        req.on('error', (err) => {
            resolve({
                url,
                status: 'error',
                success: false,
                error: err.message
            });
        });

        req.on('timeout', () => {
            req.destroy();
            resolve({
                url,
                status: 'timeout',
                success: false
            });
        });

        req.end();
    });
}

async function checkDeployment() {
    attempts++;
    console.log(`\n[${new Date().toLocaleTimeString()}] Attempt ${attempts}/${maxAttempts}`);

    const results = await Promise.all(urls.map(checkUrl));

    results.forEach(result => {
        const icon = result.success ? '✓' : '✗';
        const status = result.status === 'error' ? `Error: ${result.error}` :
                      result.status === 'timeout' ? 'Timeout' :
                      `HTTP ${result.status}`;
        console.log(`${icon} ${result.url}: ${status}`);
    });

    const allSuccess = results.every(r => r.success);

    if (allSuccess) {
        console.log('\n🎉 Deployment successful! Application is live at:');
        console.log('   https://catalog.ids.online');
        process.exit(0);
    }

    if (attempts >= maxAttempts) {
        console.log('\n⏱️  Deployment is taking longer than expected.');
        console.log('   Check GitHub Actions: https://github.com/mark-jaeger/ids-showroom/actions');
        console.log('   Or Railway dashboard for deployment logs');
        process.exit(1);
    }

    setTimeout(checkDeployment, 10000); // Check again in 10 seconds
}

console.log('🔍 Monitoring deployment...');
checkDeployment();
