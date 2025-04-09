// scripts/init-orders-table.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Create a connection to the database
const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function initOrdersTable() {
    try {
        console.log('Initializing orders table...');
        
        // Read the SQL file
        const sqlPath = path.join(__dirname, 'create-orders-table.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        
        // Execute the SQL
        await pool.query(sql);
        
        console.log('Orders table initialized successfully.');
        
        // Check if the table was created
        const result = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'orders'
            );
        `);
        
        if (result.rows[0].exists) {
            console.log('Orders table exists.');
            
            // Get column information
            const columnsResult = await pool.query(`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'orders'
                ORDER BY ordinal_position;
            `);
            
            console.log('Orders table columns:');
            columnsResult.rows.forEach(row => {
                console.log(`  ${row.column_name} (${row.data_type})`);
            });
        } else {
            console.error('Orders table does not exist after initialization!');
        }
    } catch (error) {
        console.error('Error initializing orders table:', error);
    } finally {
        await pool.end();
    }
}

// Run the initialization
initOrdersTable();
