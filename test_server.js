// test_server.js
const http = require('http');

const options = {
  hostname: 'localhost',
  port: 5001,
  path: '/',
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
    console.log('Response body:', data);
    console.log('Server is running and responding!');
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
  console.error('Server may not be running or there might be a connection issue.');
});

// End the request
req.end();

console.log('Sending request to server...');
