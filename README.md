# ShopKuya - Local Marketplace

A local marketplace application for buying and selling products.

## Features

- User authentication (sign up, sign in, password reset)
- Product listing and search
- Seller dashboard for managing products
- Admin dashboard for site management
- Order management with email notifications
- File uploads and management
- Mobile responsive design
- Email notifications for orders and account activities

## Setup Instructions

### Prerequisites

- Node.js (v14 or higher)
- PostgreSQL (v12 or higher)

### Database Setup

1. Create a PostgreSQL database for the application
2. Update the `.env` file with your database connection string:

```
DATABASE_URL=postgresql://username:password@localhost:5432/database_name
```

3. Initialize the database schema:

```
cd backend
node init-db.js
node scripts/init-orders-table.js
```

### Backend Setup

1. Navigate to the backend directory:

```
cd backend
```

2. Install dependencies:

```
npm install
```

3. Start the backend server:

```
npm start
```

The backend server will run on port 5001 by default.

### Frontend Setup

1. Navigate to the frontend directory:

```
cd frontend
```

2. Install dependencies:

```
npm install
```

3. Start the frontend development server:

```
npm start
```

The frontend development server will run on port 3000 by default.

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login a user
- `GET /api/auth/me` - Get current user information
- `GET /api/auth/check-schema` - Check database schema for authentication
- `GET /api/auth/test-db` - Test database connection

### Products
- `GET /api/products` - Get all products
- `GET /api/products/:id` - Get a single product
- `POST /api/products` - Create a new product
- `PUT /api/products/:id` - Update a product
- `DELETE /api/products/:id` - Delete a product
- `GET /api/products/seller/:sellerId` - Get products by seller
- `GET /api/products/categories/all` - Get all categories

### Orders
- `GET /api/orders` - Get all orders
- `GET /api/orders/:id` - Get a single order
- `POST /api/orders` - Create a new order
- `PUT /api/orders/:id/status` - Update order status
- `DELETE /api/orders/:id` - Delete an order
- `GET /api/orders/customer/:email` - Get orders by customer email
- `GET /api/orders/stats/summary` - Get order statistics
- `POST /api/orders/:id/comments` - Add a comment to an order
- `GET /api/orders/:id/comments` - Get comments for an order

### Uploads
- `POST /api/upload` - Upload files
- `GET /api/uploads/:filename` - Get an uploaded file

### Utility
- `GET /api/test-email` - Test email functionality
- `GET /api/db-schema` - Check database schema

## Troubleshooting

### Database Schema Issues

If you encounter database schema issues, you can run the database initialization scripts:

```
cd backend
node init-db.js
node scripts/init-orders-table.js
```

This will check the database schema and make any necessary adjustments.

### Authentication Issues

If you encounter authentication issues, you can check the database schema using the API endpoint:

```
GET /api/auth/check-schema
```

This will return information about the database schema, which can help diagnose authentication issues.

### Email Issues

If you encounter issues with email sending, you can test the email functionality using the API endpoint:

```
GET /api/test-email
```

This will send a test email to the configured email address.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
