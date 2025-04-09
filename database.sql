-- database.sql

-- Drop tables if they exist (optional, for easy reset)
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS users;

-- User Roles Enum (optional but good practice)
-- DROP TYPE IF EXISTS user_role; -- Uncomment if resetting
-- CREATE TYPE user_role AS ENUM ('user', 'seller', 'admin');

-- Users Table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    -- password_hash VARCHAR(255) NOT NULL, -- Skipping password for MVP
    email VARCHAR(100) UNIQUE, -- Add email later if needed
    role VARCHAR(10) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'seller', 'admin')), -- Using VARCHAR for simplicity, ENUM is better
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Products Table
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    image_url VARCHAR(255),
    seller_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- Link product to a seller
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    -- Add stock quantity, category etc. later
);

-- Indexes (optional but good for performance)
CREATE INDEX idx_products_seller_id ON products(seller_id);
CREATE INDEX idx_users_username ON users(username);

-- Seed Data
-- Insert Users (no passwords for MVP)
INSERT INTO users (username, role) VALUES
('testuser', 'user'),
('testseller', 'seller'),
('testadmin', 'admin');

-- Insert Products (linked to 'testseller' user, assuming ID 2)
-- Make sure the seller_id corresponds to the ID generated for 'testseller'
INSERT INTO products (name, description, price, image_url, seller_id) VALUES
(
    'Air Jordan 1 Retro High OG "Chicago Lost & Found"',
    'A legendary silhouette with a vintage aesthetic, mimicking an original pair found decades later.',
    350.00,
    'https://images.stockx.com/images/Air-Jordan-1-Retro-High-OG-Chicago-Reimagined-Product.jpg?fit=fill&bg=FFFFFF&w=700&h=500&fm=webp&auto=compress&q=90&dpr=2&trim=color&updated_at=1665691099',
    (SELECT id FROM users WHERE username = 'testseller') -- Dynamically get seller ID
),
(
    'Air Jordan 4 Retro "Military Black"',
    'Clean white leather upper with black and neutral grey accents, inspired by the original "Military Blue" colorway.',
    300.00,
    'https://images.stockx.com/images/Air-Jordan-4-Retro-Military-Black-Product.jpg?fit=fill&bg=FFFFFF&w=700&h=500&fm=webp&auto=compress&q=90&dpr=2&trim=color&updated_at=1652711111',
    (SELECT id FROM users WHERE username = 'testseller') -- Dynamically get seller ID
);

-- Function to update 'updated_at' timestamp automatically (optional but good practice)
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to use the function on products table update
CREATE TRIGGER set_timestamp
BEFORE UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- You might need a similar trigger for the users table if you add more fields


-- Verify insertions
SELECT * FROM users;
SELECT p.name, p.price, u.username as seller FROM products p JOIN users u ON p.seller_id = u.id;