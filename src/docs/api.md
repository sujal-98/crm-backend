# XenoCRM API Documentation

## Architecture Overview

XenoCRM uses a pub-sub architecture with Redis Streams for asynchronous data processing:
- API layer handles validation and publishes events
- Consumer services process events asynchronously
- Redis Streams ensures reliable message delivery
- MongoDB for data persistence

## Authentication
All routes require authentication. Include the JWT token in the Authorization header:
```
Authorization: Bearer <your-token>
```

## Response Status Codes

- `200 OK`: Request successful
- `202 Accepted`: Request accepted for processing
- `400 Bad Request`: Invalid input
- `401 Unauthorized`: Authentication required
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

## Customer Routes (`/api/customers`)

### Get All Customers
```http
GET /api/customers
```

Query Parameters:
- `search` (optional): Search in name, email, or phone
- `sortBy` (optional): Field to sort by (default: createdAt)
- `sortOrder` (optional): Sort order ('asc' or 'desc', default: 'desc')

Response (200):
```json
[
  {
    "_id": "string",
    "name": "string",
    "email": "string",
    "phone": "string",
    "address": {
      "street": "string",
      "city": "string",
      "state": "string",
      "zip": "string",
      "country": "string"
    },
    "metadata": "object",
    "createdAt": "date",
    "updatedAt": "date"
  }
]
```

### Get Customer by ID
```http
GET /api/customers/:id
```

Response (200): Customer object

### Create Customer
```http
POST /api/customers
```

Request Body:
```json
{
  "name": "string (required)",
  "email": "string (required, valid email)",
  "phone": "string (required)",
  "address": {
    "street": "string",
    "city": "string",
    "state": "string",
    "zip": "string",
    "country": "string"
  },
  "metadata": "object"
}
```

Response (202):
```json
{
  "message": "Customer creation initiated",
  "data": {
    // Request body data
  }
}
```

### Update Customer
```http
PUT /api/customers/:id
```

Request Body:
```json
{
  "name": "string",
  "email": "string (valid email)",
  "phone": "string",
  "address": "object",
  "metadata": "object"
}
```

Response (202):
```json
{
  "message": "Customer update initiated",
  "data": {
    "_id": "string",
    // Updated fields
  }
}
```

### Delete Customer
```http
DELETE /api/customers/:id
```

Response (202):
```json
{
  "message": "Customer deletion initiated",
  "data": {
    "_id": "string"
  }
}
```

## Order Routes (`/api/orders`)

### Get All Orders
```http
GET /api/orders
```

Query Parameters:
- `search` (optional): Search in order number or customer name
- `status` (optional): Filter by order status
- `startDate` (optional): Filter orders after this date
- `endDate` (optional): Filter orders before this date
- `sortBy` (optional): Field to sort by (default: createdAt)
- `sortOrder` (optional): Sort order ('asc' or 'desc', default: 'desc')

Response (200): Array of order objects

### Get Order by ID
```http
GET /api/orders/:id
```

Response (200): Order object with populated customer details

### Create Order
```http
POST /api/orders
```

Request Body:
```json
{
  "customer": "string (required, customer ID)",
  "items": [
    {
      "product": "string",
      "quantity": "number",
      "price": "number"
    }
  ],
  "totalAmount": "number (required)",
  "status": "string (required)",
  "shippingAddress": {
    "street": "string",
    "city": "string",
    "state": "string",
    "zip": "string",
    "country": "string"
  },
  "paymentMethod": "string (required)",
  "notes": "string"
}
```

Response (202):
```json
{
  "message": "Order creation initiated",
  "data": {
    // Request body data with orderNumber
  }
}
```

### Update Order
```http
PUT /api/orders/:id
```

Request Body:
```json
{
  "status": "string",
  "items": "array",
  "totalAmount": "number",
  "shippingAddress": "object",
  "paymentMethod": "string",
  "notes": "string"
}
```

Response (202):
```json
{
  "message": "Order update initiated",
  "data": {
    "_id": "string",
    // Updated fields
  }
}
```

### Delete Order
```http
DELETE /api/orders/:id
```

Response (202):
```json
{
  "message": "Order deletion initiated",
  "data": {
    "_id": "string"
  }
}
```

### Get Customer's Orders
```http
GET /api/orders/customer/:customerId
```

Response (200): Array of orders for the specified customer

## Event Types

### Customer Events
- `customer.created`: New customer creation
- `customer.updated`: Customer information update
- `customer.deleted`: Customer deletion

### Order Events
- `order.created`: New order creation
- `order.updated`: Order information update
- `order.deleted`: Order deletion

## Notes

1. All timestamps are in ISO 8601 format
2. All monetary values are in the smallest currency unit (e.g., cents for USD)
3. Search is case-insensitive
4. All routes require valid JWT authentication
5. Rate limiting may be applied to prevent abuse
6. Write operations (POST, PUT, DELETE) are asynchronous
7. Read operations (GET) return current data from the database
8. Event processing may have a slight delay
9. Failed events are retried automatically
10. Consumer services handle data persistence and relationships 