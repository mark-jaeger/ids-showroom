const https = require('https');

const zoneId = 'a2ed2619f9cdfcf3cf7d43ec00f58532';
const apiToken = 'r7pj4zltWuuS8vG-hwGGA8JkYGo91b4lHWIqArEH';

function makeRequest(method, path, data = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.cloudflare.com',
            port: 443,
            path: path,
            method: method,
            headers: {
                'Authorization': `Bearer ${apiToken}`,
                'Content-Type': 'application/json'
            }
        };

        if (data) {
            options.headers['Content-Length'] = Buffer.byteLength(data);
        }

        const req = https.request(options, (res) => {
            let responseData = '';
            res.on('data', (chunk) => { responseData += chunk; });
            res.on('end', () => {
                try {
                    resolve(JSON.parse(responseData));
                } catch (e) {
                    resolve({ success: false, error: responseData });
                }
            });
        });

        req.on('error', reject);
        if (data) req.write(data);
        req.end();
    });
}

async function fixCloudflare() {
    console.log('🔧 Fixing Cloudflare security settings...\n');

    // 1. Set Security Level to Low
    console.log('1. Setting security level to LOW...');
    const securityLevel = await makeRequest('PATCH',
        `/client/v4/zones/${zoneId}/settings/security_level`,
        JSON.stringify({ value: 'low' })
    );
    console.log(securityLevel.success ? '✓ Security level: LOW' : '✗ Failed to set security level');

    // 2. Disable Under Attack Mode (set to off)
    console.log('\n2. Disabling Under Attack Mode...');
    const underAttackMode = await makeRequest('PATCH',
        `/client/v4/zones/${zoneId}/settings/security_level`,
        JSON.stringify({ value: 'medium' })  // 'under_attack' is not a direct setting
    );

    // 3. Disable Challenge Passage
    console.log('\n3. Setting challenge passage to 30 minutes...');
    const challengePassage = await makeRequest('PATCH',
        `/client/v4/zones/${zoneId}/settings/challenge_ttl`,
        JSON.stringify({ value: 1800 })
    );
    console.log(challengePassage.success ? '✓ Challenge TTL: 30 minutes' : '✗ Failed');

    // 4. Disable Browser Integrity Check
    console.log('\n4. Disabling Browser Integrity Check...');
    const browserCheck = await makeRequest('PATCH',
        `/client/v4/zones/${zoneId}/settings/browser_check`,
        JSON.stringify({ value: 'off' })
    );
    console.log(browserCheck.success ? '✓ Browser check: OFF' : '✗ Failed');

    // 5. Get WAF settings
    console.log('\n5. Checking WAF/Firewall rules...');
    const firewallRules = await makeRequest('GET',
        `/client/v4/zones/${zoneId}/firewall/rules`
    );

    if (firewallRules.success && firewallRules.result.length > 0) {
        console.log(`Found ${firewallRules.result.length} firewall rules`);

        // Disable any "challenge" or "block" rules
        for (const rule of firewallRules.result) {
            if (rule.action === 'challenge' || rule.action === 'js_challenge' || rule.action === 'managed_challenge') {
                console.log(`   Disabling rule: ${rule.description || rule.id}`);
                await makeRequest('PATCH',
                    `/client/v4/zones/${zoneId}/firewall/rules/${rule.id}`,
                    JSON.stringify({ paused: true })
                );
            }
        }
    }

    console.log('\n✅ Cloudflare security settings updated!');
    console.log('   Wait 1-2 minutes for changes to propagate');
    console.log('   Then try: https://catalog.ids.online');
}

fixCloudflare().catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});
