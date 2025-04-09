// routes/products.js
const express = require('express');
const db = require('../db');
const router = express.Router();

/**
 * GET /api/products - Fetch all products
 * Returns a list of all products with seller information
 */
router.get('/', async (req, res) => {
    try {
        // Join with users table to get seller username
        const result = await db.query(`
            SELECT
                p.id,
                p.name,
                p.description,
                p.price,
                p.main_image,
                p.created_at,
                u.username as seller_username
            FROM products p
            JOIN users u ON p.seller_id = u.id
            ORDER BY p.created_at DESC
        `);

        // Return empty array instead of 404 if no products found
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching products:', err.message);
        res.status(500).json({
            error: 'Database Error',
            message: 'Failed to retrieve products. Please try again later.'
        });
    }
});

/**
 * GET /api/products/:id - Fetch a single product by ID
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Validate ID is a number
        if (isNaN(parseInt(id))) {
            return res.status(400).json({
                error: 'Invalid ID',
                message: 'Product ID must be a number'
            });
        }

        const result = await db.query(`
            SELECT
                p.id,
                p.name,
                p.description,
                p.price,
                p.main_image,
                p.created_at,
                u.username as seller_username
            FROM products p
            JOIN users u ON p.seller_id = u.id
            WHERE p.id = $1
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Product not found'
            });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error fetching product:', err.message);
        res.status(500).json({
            error: 'Database Error',
            message: 'Failed to retrieve product. Please try again later.'
        });
    }
});

// Placeholder for future POST endpoint (requires authentication)
/*
router.post('/', async (req, res) => {
    // TODO: Add authentication middleware here
    // Check if user role is 'seller' or 'admin'
    // ... implementation to add a product ...
    res.status(501).json({ message: 'Not Implemented' });
});
*/

module.exports = router;