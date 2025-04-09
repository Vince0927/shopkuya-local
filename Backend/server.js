// server.js
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const fileUpload = require('express-fileupload');
const multer = require('multer');
const nodemailer = require('nodemailer');
const path = require('path');
const http = require('http');
const db = require('./db');

// Import routes
const productRoutes = require('./routes/products');
const authRoutes = require('./routes/auth');
const uploadsRoutes = require('./routes/uploads');

const app = express();
const PORT = process.env.PORT || 5001; // Changed to 5001 to avoid conflict

// Middleware
app.use(cors({
    origin: 'http://localhost:3000', // React frontend URL
    credentials: true, // Allow cookies to be sent with requests
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Add OPTIONS handling for preflight requests
app.options('*', cors({
    origin: 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json()); // Parse JSON request bodies
app.use(cookieParser()); // Parse cookies
app.use(fileUpload()); // Handle file uploads

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Multer configuration for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, 'uploads'))
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname)
    },
});

const fileFilter = (req, file, cb) => {
    if (
        file.mimetype === 'application/pdf' ||
        file.mimetype === 'image/jpeg' ||
        file.mimetype === 'image/jpg' ||
        file.mimetype === 'image/png' ||
        file.mimetype === 'image/gif'
    ) {
        cb(null, true)
    } else {
        cb(new Error('Invalid file type'), false)
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
        files: 10,
    },
});

// Email transporter setup
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

// Request logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// API Routes
app.use('/api/products', productRoutes);
app.use('/api/auth', authRoutes); // Use authentication routes
app.use('/api/uploads', uploadsRoutes); // Use uploads routes

// Basic Root Route
app.get('/', (req, res) => {
    res.send('ShopKuya Backend Running!');
});

// Test email endpoint
app.get('/api/test-email', async (req, res) => {
    try {
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: process.env.EMAIL_USER,
            subject: 'ShopKuya Test Email',
            text: 'This is a test email to verify the email functionality is working.'
        });
        res.send('Test email sent successfully');
    } catch (error) {
        console.error('Email test failed:', error);
        res.status(500).send(`Email test failed: ${error.message}`);
    }
});

// Database schema check endpoint
app.get('/api/db-schema', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT table_name, column_name, data_type
            FROM information_schema.columns
            WHERE table_schema = 'public'
            ORDER BY table_name, ordinal_position
        `);

        // Group by table name
        const tables = {};
        result.rows.forEach(row => {
            if (!tables[row.table_name]) {
                tables[row.table_name] = [];
            }
            tables[row.table_name].push({
                column: row.column_name,
                type: row.data_type
            });
        });

        res.json(tables);
    } catch (error) {
        console.error('Schema check error:', error);
        res.status(500).json({
            error: 'Failed to check database schema',
            message: error.message
        });
    }
});

// File upload endpoint
app.post('/api/upload', upload.array('files', 10), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: 'No files uploaded' });
        }

        // Process uploaded files
        const uploadedFiles = req.files.map(file => ({
            filename: file.filename,
            originalname: file.originalname,
            path: file.path,
            size: file.size,
            mimetype: file.mimetype
        }));

        res.status(200).json({
            message: 'Files uploaded successfully',
            files: uploadedFiles
        });
    } catch (error) {
        console.error('File upload error:', error);
        res.status(500).json({
            error: 'Failed to upload files',
            message: error.message
        });
    }
});

// Helper function to send email
async function sendEmail(options) {
    try {
        const info = await transporter.sendMail(options);
        console.log('Email sent:', info.messageId);
        return info;
    } catch (error) {
        console.error('Error sending email:', error);
        throw error;
    }
}

// Order creation endpoint
app.post('/api/orders', upload.array('files', 10), async (req, res) => {
    try {
        console.log('Received order:', req.body);

        const {
            orderNumber,
            customerName,
            customerEmail,
            productType,
            quantity,
            price,
            address,
            notes
        } = req.body;

        // Process files information
        const filesInfo = req.files ? req.files.map((file, index) => {
            return {
                filename: file.filename,
                originalname: file.originalname,
                path: file.path,
                size: file.size,
                mimetype: file.mimetype
            };
        }) : [];

        // Database query to save order
        const query = `
            INSERT INTO orders (
                order_number,
                customer_name,
                customer_email,
                product_type,
                quantity,
                price,
                address,
                notes,
                files,
                status
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id`;

        const values = [
            orderNumber || `ORD-${Date.now()}`,
            customerName,
            customerEmail,
            productType,
            parseInt(quantity) || 1,
            parseFloat(price),
            address,
            notes,
            JSON.stringify(filesInfo),
            'pending'
        ];

        const dbResult = await db.query(query, values);

        // Prepare email content for admin
        const adminEmailContent = `
            New Order Details:
            Order Number: ${orderNumber || `ORD-${Date.now()}`}
            Customer: ${customerName}
            Email: ${customerEmail}
            Product Type: ${productType}
            Quantity: ${quantity || 1}
            Price: $${price}
            Delivery Address: ${address}
            Notes: ${notes || 'None'}
        `;

        // Prepare email content for customer
        const customerEmailContent = `
            Dear ${customerName},

            Thank you for your order with ShopKuya!

            Your order has been received and is being processed. Here's a summary of your order:

            Order Number: ${orderNumber || `ORD-${Date.now()}`}
            Product Type: ${productType}
            Quantity: ${quantity || 1}
            Total Price: $${price}
            Delivery Address: ${address}

            We will process your order as soon as possible. You will receive another notification when your order is ready for delivery.

            If you have any questions about your order, please contact us and reference your order number.

            Thank you for choosing ShopKuya!

            Best regards,
            The ShopKuya Team
        `;

        // Prepare attachments from uploaded files
        const attachments = req.files ? req.files.map(file => ({
            filename: file.originalname,
            path: file.path
        })) : [];

        // Send email to admin
        const adminMailOptions = {
            from: process.env.EMAIL_USER,
            to: process.env.EMAIL_USER, // Admin email
            subject: `New Order: ${orderNumber || `ORD-${Date.now()}`}`,
            text: adminEmailContent,
            attachments: attachments
        };

        // Send email to customer
        const customerMailOptions = {
            from: process.env.EMAIL_USER,
            to: customerEmail,
            subject: `Your ShopKuya Order Confirmation #${orderNumber || `ORD-${Date.now()}`}`,
            text: customerEmailContent
        };

        // Send both emails
        await Promise.all([
            sendEmail(adminMailOptions),
            sendEmail(customerMailOptions)
        ]);

        console.log('Emails sent successfully');
        res.status(200).json({
            message: 'Order placed successfully',
            orderNumber: orderNumber || `ORD-${Date.now()}`,
            orderId: dbResult.rows[0].id
        });

    } catch (error) {
        console.error('Error processing order:', error);
        res.status(500).json({
            message: 'Failed to process order: ' + error.message
        });
    }
});

// Get all orders
app.get('/api/orders', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM orders ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ message: 'Failed to fetch orders' });
    }
});

// Get order statistics
app.get('/api/orders/stats/summary', async (req, res) => {
    try {
        const query = `
            SELECT
                COUNT(*) as total_orders,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_orders,
                SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing_orders,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_orders,
                SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_orders,
                SUM(CAST(price AS DECIMAL)) as total_revenue
            FROM orders
        `;
        const result = await db.query(query);
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching order statistics:', error);
        res.status(500).json({ message: 'Failed to fetch order statistics' });
    }
});

// Get order by ID
app.get('/api/orders/:id', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM orders WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Order not found' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching order:', error);
        res.status(500).json({ message: 'Failed to fetch order' });
    }
});

// Get orders by customer email
app.get('/api/orders/customer/:email', async (req, res) => {
    try {
        const result = await db.query(
            'SELECT * FROM orders WHERE customer_email = $1 ORDER BY created_at DESC',
            [req.params.email]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching customer orders:', error);
        res.status(500).json({ message: 'Failed to fetch customer orders' });
    }
});

// Update order status
app.put('/api/orders/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!status) {
            return res.status(400).json({ error: 'Status is required' });
        }

        // Validate status
        const validStatuses = ['pending', 'processing', 'completed', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                error: 'Invalid status',
                validStatuses
            });
        }

        // Check if order exists
        const checkResult = await db.query('SELECT id FROM orders WHERE id = $1', [id]);
        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        // Update order status
        const updateResult = await db.query(
            'UPDATE orders SET status = $1 WHERE id = $2 RETURNING *',
            [status, id]
        );

        res.json({
            message: 'Order status updated successfully',
            order: updateResult.rows[0]
        });
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({ error: 'Failed to update order status' });
    }
});

// Delete order
app.delete('/api/orders/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Check if order exists
        const checkResult = await db.query('SELECT id FROM orders WHERE id = $1', [id]);
        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        // Delete order
        await db.query('DELETE FROM orders WHERE id = $1', [id]);

        res.json({ message: 'Order deleted successfully' });
    } catch (error) {
        console.error('Error deleting order:', error);
        res.status(500).json({ error: 'Failed to delete order' });
    }
});



// Add comment to order
app.post('/api/orders/:id/comments', async (req, res) => {
    try {
        const { id } = req.params;
        const { text, author } = req.body;

        if (!text) {
            return res.status(400).json({ error: 'Comment text is required' });
        }

        // Check if order exists and get current comments
        const checkQuery = `SELECT id, comments FROM orders WHERE id = $1`;
        const checkResult = await db.query(checkQuery, [id]);

        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        // Get current comments or initialize empty array
        const currentComments = checkResult.rows[0].comments || [];

        // Create new comment
        const newComment = {
            id: Date.now().toString(),
            text,
            author: author || 'Customer',
            timestamp: new Date().toISOString()
        };

        // Add new comment to array
        const updatedComments = [...currentComments, newComment];

        // Update order with new comments
        const updateQuery = `UPDATE orders SET comments = $1 WHERE id = $2 RETURNING *`;
        const result = await db.query(updateQuery, [JSON.stringify(updatedComments), id]);

        res.json({
            message: 'Comment added successfully',
            comment: newComment,
            order: result.rows[0]
        });
    } catch (error) {
        console.error('Error adding comment:', error);
        res.status(500).json({ error: 'Failed to add comment' });
    }
});

// Get comments for an order
app.get('/api/orders/:id/comments', async (req, res) => {
    try {
        const { id } = req.params;

        // Get order with comments
        const query = `SELECT comments FROM orders WHERE id = $1`;
        const result = await db.query(query, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        res.json(result.rows[0].comments || []);
    } catch (error) {
        console.error('Error fetching comments:', error);
        res.status(500).json({ error: 'Failed to fetch comments' });
    }
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