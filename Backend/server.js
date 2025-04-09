// server.js
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const fileUpload = require('express-fileupload');
const path = require('path');
const productRoutes = require('./routes/products');
const authRoutes = require('./routes/auth');
const uploadsRoutes = require('./routes/uploads');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 5001; // Changed to 5001 to avoid conflict

// Middleware
app.use(cors({
    origin: 'http://localhost:3000', // React frontend URL
    credentials: true // Allow cookies to be sent with requests
}));
app.use(express.json()); // Parse JSON request bodies
app.use(cookieParser()); // Parse cookies
app.use(fileUpload()); // Handle file uploads

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Routes
app.use('/api/products', productRoutes);
app.use('/api/auth', authRoutes); // Use authentication routes
app.use('/api/uploads', uploadsRoutes); // Use uploads routes

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