# XenoCRM API Documentation

## Authentication

### Google OAuth Login
```http
GET /api/auth/google
```
Initiates Google OAuth login flow. Redirects to Google consent screen.

### Google OAuth Callback
```http
GET /api/auth/google/callback
```
Handles OAuth callback from Google. Redirects to frontend with session cookie.

### Check Session Status
```http
GET /api/auth/session
```
Returns current session status and user info.

**Response:**
```json
{
  "status": "success",
  "data": {
    "isAuthenticated": true,
    "user": {
      "id": "user_id",
      "email": "user@example.com",
      "name": "User Name"
    },
    "sessionExpiresIn": 7200000,
    "sessionExpiresAt": "2024-03-21T10:00:00.000Z"
  }
}
```

### Logout
```http
POST /api/auth/logout
```
Destroys the current session.

## Customers

### List Customers
```http
GET /api/customers
```
Get all customers with optional filtering.

**Query Parameters:**
- `search` (string): Search in name, email, phone
- `status` (string): Filter by status
- `segment` (string): Filter by segment
- `sortBy` (string): Sort field (default: createdAt)
- `sortOrder` (string): Sort direction (asc/desc)
- `page` (number): Page number
- `limit` (number): Items per page

**Response:**
```json
{
  "status": "success",
  "data": {
    "customers": [
      {
        "id": "customer_id",
        "name": "Customer Name",
        "email": "customer@example.com",
        "phone": "+1234567890",
        "status": "active",
        "totalOrders": 5,
        "totalSpend": 1000,
        "lastOrderDate": "2024-03-20T10:00:00.000Z"
      }
    ],
    "total": 100,
    "page": 1,
    "limit": 10
  }
}
```

### Get Customer
```http
GET /api/customers/:id
```
Get customer details by ID.

**Response:**
```json
{
  "status": "success",
  "data": {
    "id": "customer_id",
    "name": "Customer Name",
    "email": "customer@example.com",
    "phone": "+1234567890",
    "address": {
      "street": "123 Main St",
      "city": "City",
      "state": "State",
      "zip": "12345"
    },
    "status": "active",
    "totalOrders": 5,
    "totalSpend": 1000,
    "lastOrderDate": "2024-03-20T10:00:00.000Z",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### Create Customer
```http
POST /api/customers
```
Create a new customer.

**Request Body:**
```json
{
  "name": "Customer Name",
  "email": "customer@example.com",
  "phone": "+1234567890",
  "address": {
    "street": "123 Main St",
    "city": "City",
    "state": "State",
    "zip": "12345"
  }
}
```

### Update Customer
```http
PUT /api/customers/:id
```
Update customer details.

**Request Body:**
```json
{
  "name": "Updated Name",
  "phone": "+1987654321",
  "address": {
    "street": "456 New St"
  }
}
```

## Orders

### List Orders
```http
GET /api/orders
```
Get all orders with optional filtering.

**Query Parameters:**
- `search` (string): Search in order number or customer name
- `status` (string): Filter by status
- `startDate` (string): Filter by start date
- `endDate` (string): Filter by end date
- `sortBy` (string): Sort field (default: createdAt)
- `sortOrder` (string): Sort direction (asc/desc)

**Response:**
```json
{
  "status": "success",
  "data": {
    "orders": [
      {
        "id": "order_id",
        "orderNumber": "ORD-123456",
        "customer": {
          "id": "customer_id",
          "name": "Customer Name"
        },
        "items": [
          {
            "product_id": "product_id",
            "name": "Product Name",
            "price": 100
          }
        ],
        "totalAmount": 100,
        "status": "completed",
        "orderDate": "2024-03-20T10:00:00.000Z"
      }
    ]
  }
}
```

### Get Order
```http
GET /api/orders/:id
```
Get order details by ID.

### Create Order
```http
POST /api/orders
```
Create a new order.

**Request Body:**
```json
{
  "customer": "customer_id",
  "items": [
    {
      "product_id": "product_id",
      "name": "Product Name",
      "price": 100
    }
  ],
  "totalAmount": 100,
  "shippingAddress": {
    "street": "123 Main St",
    "city": "City",
    "state": "State",
    "zip": "12345"
  },
  "paymentMethod": "credit_card"
}
```

### Update Order
```http
PUT /api/orders/:id
```
Update order status or details.

**Request Body:**
```json
{
  "status": "shipped",
  "trackingNumber": "TRK123456"
}
```

## Campaigns

### List Campaigns
```http
GET /api/campaigns
```
Get all campaigns.

**Query Parameters:**
- `status` (string): Filter by status
- `sortBy` (string): Sort field
- `sortOrder` (string): Sort direction

### Create Campaign
```http
POST /api/campaigns
```
Create a new campaign.

**Request Body:**
```json
{
  "name": "Summer Sale",
  "segment": "segment_id",
  "template": {
    "subject": "Summer Sale 2024",
    "body": "Dear {{customer.name}}, ..."
  },
  "schedule": {
    "type": "immediate",
    "date": "2024-03-21T10:00:00.000Z"
  }
}
```

### Get Campaign Stats
```http
GET /api/campaigns/:id/stats
```
Get campaign performance statistics.

## Segments

### List Segments
```http
GET /api/segments
```
Get all customer segments.

### Create Segment
```http
POST /api/segments
```
Create a new customer segment.

**Request Body:**
```json
{
  "name": "High Value Customers",
  "conditions": [
    {
      "field": "totalSpend",
      "operator": "gte",
      "value": 1000
    }
  ]
}
```

## Dashboard

### Get Dashboard Stats
```http
GET /api/dashboard/stats
```
Get overview statistics for the dashboard.

**Query Parameters:**
- `email` (string): User email for filtering stats

**Response:**
```json
{
  "status": "success",
  "data": {
    "overview": {
      "totalCustomers": 1000,
      "totalSegments": 10,
      "totalCampaigns": 50,
      "messagesSent": 5000,
      "messagesFailed": 100,
      "successRate": 98.0
    },
    "recentCampaigns": [...],
    "recentSegments": [...],
    "campaignPerformance": [...]
  }
}
```

## Error Responses

All endpoints may return the following error responses:

```json
{
  "status": "error",
  "message": "Error message",
  "code": "ERROR_CODE"
}
```

Common error codes:
- `NOT_AUTHENTICATED`: User not logged in
- `INVALID_REQUEST`: Invalid request parameters
- `NOT_FOUND`: Resource not found
- `UNAUTHORIZED`: Insufficient permissions
- `INTERNAL_ERROR`: Server error

## Rate Limiting

API endpoints are rate limited:
- 100 requests per minute for authenticated users
- 20 requests per minute for unauthenticated users

## Webhooks (When Redis is Enabled)

The system publishes events to Redis streams when Redis is enabled:

### Customer Events
- `customer.created`
- `customer.updated`
- `customer.deleted`

### Order Events
- `order.created`
- `order.updated`
- `order.deleted`

### Campaign Events
- `campaign.created`
- `campaign.started`
- `campaign.completed`
- `campaign.failed` 