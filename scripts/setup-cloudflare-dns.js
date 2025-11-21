const https = require('https');
require('dotenv').config();

const zoneId = process.env.CLOUDFLARE_ZONE_ID;
const apiToken = process.env.CLOUDFLARE_API_TOKEN;

const data = JSON.stringify({
    type: 'CNAME',
    name: 'catalog',
    content: 'ngrdpxhz.up.railway.app',
    ttl: 1,
    proxied: true,
    comment: 'Railway app deployment'
});

if (!zoneId || !apiToken) {
    console.error('❌ Missing required environment variables:');
    console.error('   CLOUDFLARE_ZONE_ID');
    console.error('   CLOUDFLARE_API_TOKEN');
    process.exit(1);
}

const options = {
    hostname: 'api.cloudflare.com',
    port: 443,
    path: `/client/v4/zones/${zoneId}/dns_records`,
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

const req = https.request(options, (res) => {
    let responseData = '';

    res.on('data', (chunk) => {
        responseData += chunk;
    });

    res.on('end', () => {
        const response = JSON.parse(responseData);

        if (response.success) {
            console.log('✓ DNS record created successfully!');
            console.log('\nRecord details:');
            console.log(`  Type: ${response.result.type}`);
            console.log(`  Name: ${response.result.name}`);
            console.log(`  Content: ${response.result.content}`);
            console.log(`  Proxied: ${response.result.proxied}`);
            console.log(`  ID: ${response.result.id}`);
            console.log('\nDomain should be accessible at: https://catalog.ids.online');
            console.log('Note: SSL certificate provisioning may take 1-5 minutes');
        } else {
            console.error('✗ Failed to create DNS record');
            console.error('Errors:', JSON.stringify(response.errors, null, 2));
        }
    });
});

req.on('error', (error) => {
    console.error('✗ Request failed:', error.message);
});

req.write(data);
req.end();
