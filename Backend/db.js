// db.js
const { Pool } = require('pg');
require('dotenv').config();

// Check if DATABASE_URL is defined
if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not defined in environment variables!');
    console.error('Please create a .env file with DATABASE_URL=postgresql://username:password@localhost:5432/database_name');

    // Instead of exiting, set a default for development
    if (process.env.NODE_ENV !== 'production') {
        console.warn('Using default DATABASE_URL for development');
        process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/shopkuya';
    } else {
        process.exit(1); // Only exit in production
    }
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
            console.log('Executing query:', { text, params: Array.isArray(params) ? params : 'No params' });
            const result = await pool.query(text, params);
            return result;
        } catch (error) {
            console.error('Database query error:', error.message);
            console.error('Query that failed:', { text, params: Array.isArray(params) ? params : 'No params' });

            // Add more details to the error
            error.query = text;
            error.params = params;

            throw error; // Re-throw to let route handlers catch it
        }
    },
    pool: pool // Export pool if needed elsewhere
};