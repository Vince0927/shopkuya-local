// db.js
const { Pool } = require('pg');
require('dotenv').config();

// Check if DATABASE_URL is defined
if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not defined in environment variables!');
    console.error('Please create a .env file with DATABASE_URL=postgresql://username:password@localhost:5432/database_name');
    process.exit(1); // Exit with error
}

// Create connection pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Uncomment for production deployments that require SSL (e.g., Heroku)
    // ssl: {
    //   rejectUnauthorized: false
    // }
});

// Connection event handlers
pool.on('connect', () => {
    console.log('Connected to the PostgreSQL database');
});

pool.on('error', (err) => {
    console.error('Unexpected database error:', err);
    // Don't exit process here, let the specific query handle errors
});

// Export database functions
module.exports = {
    /**
     * Execute a SQL query with optional parameters
     * @param {string} text - SQL query text
     * @param {Array} params - Query parameters
     * @returns {Promise} - Query result
     */
    query: async (text, params) => {
        try {
            return await pool.query(text, params);
        } catch (error) {
            console.error('Database query error:', error.message);
            throw error; // Re-throw to let route handlers catch it
        }
    },
    pool: pool // Export pool if needed elsewhere
};