const https = require('https');

const token = 'c4cea773-3c1c-40c9-a15c-26c91fe2fa4c';
const projectId = '20de9239-2262-4731-b25a-61da9df33f9d';

const query = {
    query: `query {
        project(id: "${projectId}") {
            services {
                edges {
                    node {
                        id
                        name
                    }
                }
            }
        }
    }`
};

const data = JSON.stringify(query);

const options = {
    hostname: 'backboard.railway.app',
    port: 443,
    path: '/graphql/v2',
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${token}`,
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
        try {
            const response = JSON.parse(responseData);
            console.log(JSON.stringify(response, null, 2));

            if (response.data && response.data.project && response.data.project.services) {
                console.log('\n=== Services in this project ===');
                response.data.project.services.edges.forEach(edge => {
                    console.log(`Service ID: ${edge.node.id}`);
                    console.log(`Service Name: ${edge.node.name || '(unnamed)'}`);
                    console.log('---');
                });
            }
        } catch (e) {
            console.error('Failed to parse response:', e.message);
            console.log('Raw response:', responseData);
        }
    });
});

req.on('error', (error) => {
    console.error('Request failed:', error.message);
});

req.write(data);
req.end();
