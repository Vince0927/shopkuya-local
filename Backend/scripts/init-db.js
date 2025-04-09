// scripts/init-db.js
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Create a connection to the database
const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

// Export the query function for use in the script
const db = {
    query: async (text, params) => {
        try {
            console.log('Executing query:', { text, params: Array.isArray(params) ? params : 'No params' });
            const result = await pool.query(text, params);
            return result;
        } catch (error) {
            console.error('Database query error:', error.message);
            throw error;
        }
    },
    pool
};

/**
 * Initialize the database schema
 */
async function initializeDatabase() {
    try {
        console.log('Checking database schema...');

        // Check if users table exists
        const tableCheckResult = await db.query(
            "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users')"
        );

        const usersTableExists = tableCheckResult.rows[0].exists;

        if (usersTableExists) {
            console.log('Users table already exists. Checking schema...');

            // Check users table columns
            const columnsResult = await db.query(
                "SELECT column_name FROM information_schema.columns WHERE table_name = 'users'"
            );

            const columns = columnsResult.rows.map(row => row.column_name);
            console.log('Existing columns in users table:', columns);

            // Check if password_hash column exists
            if (!columns.includes('password_hash')) {
                if (columns.includes('password')) {
                    console.log('Found "password" column instead of "password_hash". Renaming...');

                    // Rename password column to password_hash
                    await db.query('ALTER TABLE users RENAME COLUMN password TO password_hash');
                    console.log('Column renamed successfully.');
                } else {
                    console.log('No password column found. Adding password_hash column...');

                    // Add password_hash column
                    await db.query('ALTER TABLE users ADD COLUMN password_hash VARCHAR(255) NOT NULL DEFAULT \'\'');
                    console.log('password_hash column added successfully.');
                }
            } else {
                console.log('password_hash column already exists.');
            }

            // Check for other required columns
            const requiredColumns = [
                { name: 'email_verified', type: 'BOOLEAN', default: 'DEFAULT FALSE' },
                { name: 'profile_picture', type: 'VARCHAR(255)', default: '' },
                { name: 'created_at', type: 'TIMESTAMP WITH TIME ZONE', default: 'DEFAULT CURRENT_TIMESTAMP' },
                { name: 'updated_at', type: 'TIMESTAMP WITH TIME ZONE', default: 'DEFAULT CURRENT_TIMESTAMP' }
            ];

            for (const column of requiredColumns) {
                if (!columns.includes(column.name)) {
                    console.log(`Adding missing column: ${column.name}`);
                    await db.query(`ALTER TABLE users ADD COLUMN ${column.name} ${column.type} ${column.default}`);
                    console.log(`${column.name} column added successfully.`);
                }
            }
        } else {
            console.log('Users table does not exist. Creating from schema...');

            // Read the database.sql file
            const schemaPath = path.join(__dirname, '../../database.sql');
            const schemaSql = fs.readFileSync(schemaPath, 'utf8');

            // Execute the schema SQL
            await db.query(schemaSql);
            console.log('Database schema created successfully.');
        }

        // Check if email_verification_tokens table exists
        const tokenTableCheckResult = await db.query(
            "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'email_verification_tokens')"
        );

        const tokenTableExists = tokenTableCheckResult.rows[0].exists;

        if (!tokenTableExists) {
            console.log('Creating email_verification_tokens table...');

            await db.query(`
                CREATE TABLE email_verification_tokens (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    token VARCHAR(255) NOT NULL,
                    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                )
            `);

            console.log('email_verification_tokens table created successfully.');
        }

        console.log('Database initialization completed successfully.');
    } catch (error) {
        console.error('Error initializing database:', error);
        process.exit(1);
    } finally {
        // Close the database connection
        process.exit(0);
    }
}

// Run the initialization
initializeDatabase();
