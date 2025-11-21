const https = require('https');
require('dotenv').config();

const zoneId = process.env.CLOUDFLARE_ZONE_ID || 'a2ed2619f9cdfcf3cf7d43ec00f58532';
const apiToken = process.env.CLOUDFLARE_API_TOKEN || 'r7pj4zltWuuS8vG-hwGGA8JkYGo91b4lHWIqArEH';

if (!zoneId || !apiToken) {
    console.error('❌ Missing required environment variables');
    process.exit(1);
}

console.log('🔍 Finding existing DNS record for catalog.ids.online...');

// Step 1: Get the existing DNS record
const getOptions = {
    hostname: 'api.cloudflare.com',
    port: 443,
    path: `/client/v4/zones/${zoneId}/dns_records?name=catalog.ids.online`,
    method: 'GET',
    headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
    }
};

const getReq = https.request(getOptions, (res) => {
    let responseData = '';

    res.on('data', (chunk) => {
        responseData += chunk;
    });

    res.on('end', () => {
        const response = JSON.parse(responseData);

        if (!response.success || response.result.length === 0) {
            console.error('✗ Could not find existing DNS record');
            console.error('Response:', JSON.stringify(response, null, 2));
            process.exit(1);
        }

        const record = response.result[0];
        console.log(`✓ Found record: ${record.name} → ${record.content}`);
        console.log(`  Record ID: ${record.id}`);

        // Step 2: Update the DNS record
        console.log('\n📝 Updating DNS record to point to ids-showroom-production.up.railway.app...');

        const updateData = JSON.stringify({
            type: 'CNAME',
            name: 'catalog',
            content: 'ids-showroom-production.up.railway.app',
            ttl: 1,
            proxied: true,
            comment: 'Railway app deployment (updated)'
        });

        const updateOptions = {
            hostname: 'api.cloudflare.com',
            port: 443,
            path: `/client/v4/zones/${zoneId}/dns_records/${record.id}`,
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${apiToken}`,
                'Content-Type': 'application/json',
                'Content-Length': updateData.length
            }
        };

        const updateReq = https.request(updateOptions, (updateRes) => {
            let updateResponseData = '';

            updateRes.on('data', (chunk) => {
                updateResponseData += chunk;
            });

            updateRes.on('end', () => {
                const updateResponse = JSON.parse(updateResponseData);

                if (updateResponse.success) {
                    console.log('✓ DNS record updated successfully!');
                    console.log('\nUpdated record details:');
                    console.log(`  Type: ${updateResponse.result.type}`);
                    console.log(`  Name: ${updateResponse.result.name}`);
                    console.log(`  Content: ${updateResponse.result.content}`);
                    console.log(`  Proxied: ${updateResponse.result.proxied}`);
                    console.log('\n🎉 Domain should now work at: https://catalog.ids.online');
                    console.log('Note: DNS changes may take 1-2 minutes to propagate');
                } else {
                    console.error('✗ Failed to update DNS record');
                    console.error('Errors:', JSON.stringify(updateResponse.errors, null, 2));
                    process.exit(1);
                }
            });
        });

        updateReq.on('error', (error) => {
            console.error('✗ Update request failed:', error.message);
            process.exit(1);
        });

        updateReq.write(updateData);
        updateReq.end();
    });
});

getReq.on('error', (error) => {
    console.error('✗ Get request failed:', error.message);
    process.exit(1);
});

getReq.end();
