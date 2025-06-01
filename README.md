# XenoCRM Backend

A robust Node.js/Express backend for XenoCRM with MongoDB integration, featuring customer segmentation, campaign management, and analytics.

## Features

### Customer Management API
- **CRUD Operations**
  - Create new customers with validation
  - Retrieve customer details with filtering and pagination
  - Update customer information
  - Delete customer records
- **Activity Tracking**
  - Order history logging
  - Last active timestamp
  - Total spend calculation
  - Customer status management

### Segmentation Engine
- **Dynamic Rule-Based Segmentation**
  - Multiple condition support:
    - Total spend ranges
    - Days since last order
    - Customer status
    - Order frequency
  - Real-time customer filtering
  - Segment preview functionality
  - Segment storage and retrieval

### Campaign Management
- **Campaign Creation & Execution**
  - Campaign metadata management
  - Target segment association
  - Message templating
  - Automated campaign execution
- **Message Delivery System**
  - Vendor API integration
  - 90/10 success/failure rate simulation
  - Batch processing for messages
  - Real-time delivery status updates
- **Queue Management**
  - Bull queue for message processing
  - Retry mechanism for failed deliveries
  - Rate limiting implementation
  - Queue monitoring capabilities

### Analytics & Reporting
- **Customer Metrics**
  - Total customer count
  - Active vs inactive customers
  - Customer growth trends
  - Spending patterns
- **Campaign Performance**
  - Success/failure rates
  - Delivery statistics
  - Campaign effectiveness metrics
  - Historical campaign data

## Tech Stack

- **Core**
  - Node.js (v14+)
  - Express.js (v4.17+)
  - MongoDB with Mongoose
  - Bull Queue

- **Security**
  - JWT Authentication
  - bcrypt for password hashing
  - helmet for HTTP security
  - cors for resource sharing

- **Development**
  - ESLint for code quality
  - Jest for testing
  - Morgan for logging
  - Nodemon for development

## Project Structure

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file with:
```
REACT_APP_API_URL=http://localhost:5000
MONGODB_URI=your 