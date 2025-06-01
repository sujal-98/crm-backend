# XenoCRM Backend

A robust CRM backend system built with Node.js, Express, and MongoDB.

## Features

- 🔐 Secure authentication with Google OAuth
- 👥 Customer management
- 📊 Order tracking
- 📈 Analytics and reporting
- 📧 Email campaign management
- 🔄 Real-time updates (via MongoDB)

## Tech Stack

- Node.js & Express
- MongoDB (with Mongoose)
- Google OAuth 2.0
- Express Session with MongoDB store
- ~~Redis~~ (Commented out for deployment)

## Architecture Notes

### Session Management
- Sessions are stored in MongoDB using `connect-mongodb-session`
- Session duration: 2 hours with rolling updates

### Message Broker (Currently Disabled For Deployment Purpose - just uncomment it to use it)
The application was designed with a Redis-based message broker for:
- Event-driven architecture
- Async order processing
- Campaign queue management
- Real-time notifications

However, due to limited deployment options, Redis has been temporarily disabled. 
However , you can uncomment the redis part to make the message broker work
The system now:
- Uses direct database operations instead of message queues
- Maintains the same API interface for future Redis integration
- Logs events that would have been published to Redis
- Stores all data in MongoDB

To re-enable Redis:
1. Uncomment Redis code in:
   - `src/config/redis.js`
   - `src/services/messageBroker.js`
   - `src/routes/orders.js`
2. Update deployment configuration
3. Make sure redis is running in your local system

## Environment Variables

```env
NODE_ENV=development
PORT=4000
MONGODB_URI=your mongodb url
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
SESSION_SECRET=your-session-secret
FRONTEND_URL=http://localhost:3000
GEMINI_API_KEY=your gemini key
```

## Development Setup

### Running Without Redis (Default)

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create `.env` file with required variables (Redis URL can be commented out)
4. Start MongoDB locally or use a cloud instance
5. Start development server:
   ```bash
   npm run dev
   ```
   The application will run with direct database operations and MongoDB session store.

### Running With Redis (Advanced Setup)

1. Follow steps 1-3 from "Running Without Redis"
2. Install Redis on your system:
   - **Windows**: Download and install from [Redis Windows](https://github.com/microsoftarchive/redis/releases)
   - **macOS**: `brew install redis`
   - **Linux**: `sudo apt-get install redis-server`
3. Start Redis server:
   - **Windows**: Start Redis service or run `redis-server`
   - **macOS/Linux**: `redis-server`
4. Uncomment Redis code in:
   - `src/config/redis.js`
   - `src/services/messageBroker.js`
   - `src/routes/orders.js`
5. Start development server:
   ```bash
   nodemon index.js
   ```
6. In separate terminal windows, start the consumer threads:
   ```bash
   # Terminal 1 - Customer Events Consumer
   node src/consumers/customerConsumer.js

   # Terminal 2 - Order Events Consumer
   node src/consumers/orderConsumer.js
   ```

   The application will now use Redis for:
   - Message broker functionality
   - Async order processing
   - Event-driven architecture
   - Real-time notifications

   Note: All three processes (main server and two consumers) must be running for full functionality:
   - Main server (`nodemon index.js`) - Handles HTTP requests and publishes events
   - Customer Consumer - Processes customer-related events
   - Order Consumer - Processes order-related events

### Verifying Redis Connection

To verify Redis is working:
1. Check server logs for "Connected to Redis" message
2. Check consumer logs for "Consumer started" messages
3. Create a new order - you should see:
   - Redis event logs in main server
   - Order processing logs in order consumer
   - Customer update logs in customer consumer


### Deployment Considerations

- MongoDB is used for both data storage and session management
- When Redis is enabled:
  - All async operations are handled by consumer threads
  - Event logging is done via Redis streams
  - Session management is handled by MongoDB store
  - Three processes must be managed (main server + two consumers)
- When Redis is disabled:
  - All async operations are handled synchronously
  - Event logging is done via console
  - Session management is handled by MongoDB store
  - Only one process needs to be managed (main server)


