const https = require('https');

const zoneId = 'a2ed2619f9cdfcf3cf7d43ec00f58532';
const apiToken = 'r7pj4zltWuuS8vG-hwGGA8JkYGo91b4lHWIqArEH';

console.log('🔍 Finding DNS record...');

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
    res.on('data', (chunk) => { responseData += chunk; });
    res.on('end', () => {
        const response = JSON.parse(responseData);
        const record = response.result[0];

        console.log(`✓ Current: ${record.name} → ${record.content}`);
        console.log('\n📝 Updating to correct Railway URL...');

        const updateData = JSON.stringify({
            type: 'CNAME',
            name: 'catalog',
            content: 'rnipj0zu.up.railway.app',
            ttl: 1,
            proxied: true  // Re-enable proxy
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
            updateRes.on('data', (chunk) => { updateResponseData += chunk; });
            updateRes.on('end', () => {
                const updateResponse = JSON.parse(updateResponseData);
                if (updateResponse.success) {
                    console.log('✓ DNS updated successfully!');
                    console.log(`  New target: rnipj0zu.up.railway.app`);
                    console.log('  Proxied: true (Cloudflare protection enabled)');
                    console.log('\n🎉 Domain should work in 1-2 minutes at:');
                    console.log('   https://catalog.ids.online');
                } else {
                    console.error('✗ Failed:', JSON.stringify(updateResponse.errors));
                }
            });
        });
        updateReq.on('error', (error) => { console.error('✗ Error:', error.message); });
        updateReq.write(updateData);
        updateReq.end();
    });
});

getReq.on('error', (error) => { console.error('✗ Error:', error.message); });
getReq.end();
