// test-login.js
const axios = require('axios');

async function testLogin() {
    try {
        console.log('Testing login API...');
        
        const response = await axios.post('http://localhost:5001/api/auth/login', {
            username: 'testuser',
            password: 'password123'
        });
        
        console.log('Login successful!');
        console.log('Response:', response.data);
        
        // Get the token from the response
        const token = response.data.token;
        
        // Test the /me endpoint with the token
        console.log('\nTesting /me endpoint with token...');
        
        const meResponse = await axios.get('http://localhost:5001/api/auth/me', {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
        
        console.log('Me endpoint successful!');
        console.log('User data:', meResponse.data);
    } catch (error) {
        console.error('Error:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
            console.error('Response status:', error.response.status);
        }
    }
}

testLogin();
