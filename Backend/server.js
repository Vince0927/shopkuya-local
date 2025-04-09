// server.js
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const productRoutes = require('./routes/products');
const authRoutes = require('./routes/auth'); // Simulated auth routes
const http = require('http');

const app = express();
const PORT = process.env.PORT || 5001; // Changed to 5001 to avoid conflict

// Middleware
app.use(cors()); // Allow requests from React frontend (different port)
app.use(express.json()); // Parse JSON request bodies

// API Routes
app.use('/api/products', productRoutes);
app.use('/api/auth', authRoutes); // Use simulated auth routes

// Basic Root Route
app.get('/', (req, res) => {
    res.send('ShopKuya Backend Running!');
});

// Enhanced Error Handling Middleware
app.use((err, req, res, next) => {
    console.error('Server Error:', err.stack);
    res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

// Create HTTP server
const server = http.createServer(app);

// Start Server with error handling for port conflicts
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    // Test DB connection on start
    require('./db').query('SELECT NOW()', (err, res) => {
        if (err) {
            console.error("Database connection error:", err);
        } else {
            console.log("Database connected successfully at:", res.rows[0].now);
        }
    });
});

server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Try a different port.`);
        process.exit(1);
    } else {
        console.error('Server error:', error);
    }
});