// test_auth_api.js
const http = require('http');

const options = {
  hostname: 'localhost',
  port: 5001,
  path: '/api/auth/me',
  method: 'GET'
};

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
  
  res.setEncoding('utf8');
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const user = JSON.parse(data);
      console.log('Current user:');
      console.log(`- ID: ${user.id}`);
      console.log(`- Username: ${user.username}`);
      console.log(`- Role: ${user.role}`);
    } catch (e) {
      console.error('Error parsing response:', e.message);
      console.log('Raw response:', data);
    }
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

// End the request
req.end();

console.log('Fetching current user from API...');
