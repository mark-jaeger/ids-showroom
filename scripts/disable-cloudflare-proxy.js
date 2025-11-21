const https = require('https');
require('dotenv').config();

const zoneId = process.env.CLOUDFLARE_ZONE_ID || 'a2ed2619f9cdfcf3cf7d43ec00f58532';
const apiToken = process.env.CLOUDFLARE_API_TOKEN || 'r7pj4zltWuuS8vG-hwGGA8JkYGo91b4lHWIqArEH';

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

        console.log(`✓ Found: ${record.name} → ${record.content}`);
        console.log(`  Currently proxied: ${record.proxied}`);

        if (!record.proxied) {
            console.log('✓ Proxy already disabled');
            process.exit(0);
        }

        console.log('\n🔧 Disabling Cloudflare proxy...');

        const updateData = JSON.stringify({
            type: 'CNAME',
            name: 'catalog',
            content: 'ids-showroom-production.up.railway.app',
            ttl: 1,
            proxied: false  // DISABLE PROXY
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
                    console.log('✓ Cloudflare proxy disabled!');
                    console.log('  DNS now points directly to Railway');
                    console.log('  Wait 30-60 seconds for DNS propagation');
                    console.log('\n⚠️  Note: Without Cloudflare proxy:');
                    console.log('  - No DDoS protection');
                    console.log('  - No caching');
                    console.log('  - But direct connection to Railway');
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
