require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoDBStore = require('connect-mongodb-session')(session);
const passport = require('./config/passport');
const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const rateLimit = require('express-rate-limit');
const { errorHandler } = require('./middleware/errorHandler');
const { logger } = require('./utils/logger');
const messageBroker = require('./services/messageBroker');

// Import routes
const authRoutes = require('./routes/auth');
const customerRoutes = require('./routes/customers');
const orderRoutes = require('./routes/orders');
const segmentationRoutes = require('./routes/segmentation');
const deliveryReceiptRoutes = require('./routes/deliveryReceipt');
const campaignRoutes = require('./routes/campaigns');
const segmentRoutes = require('./routes/segments');

// Initialize express app
const app = express();

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'XenoCRM API',
      version: '1.0.0',
      description: 'API documentation for XenoCRM',
    },
    servers: [
      {
        url: process.env.API_URL || 'http://localhost:4000',
        description: 'Development server',
      },
    ],
  },
  apis: ['./src/routes/*.js'],
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Create session store
const store = new MongoDBStore({
  uri: process.env.MONGODB_URI,
  databaseName: 'xenocrm',
  collection: 'sessions'
});

// Handle store errors
store.on('error', function(error) {
  console.error('Session store error:', error);
});

// Initialize connections and start server
async function startServer() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB');

    // Basic middleware
    app.use(helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
      crossOriginOpenerPolicy: { policy: "unsafe-none" }
    }));

    // CORS configuration
    const corsOptions = {
      origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        
        const allowedOrigins = [
          process.env.FRONTEND_URL || 'http://localhost:3000',
          'https://accounts.google.com'
        ];
        
        if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    };

    app.use(cors(corsOptions));

    // Special CORS handling for Google OAuth routes
    app.use('/api/auth/google', (req, res, next) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      next();
    });

    app.use(express.json());
    app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

    // Session middleware - MUST be before routes
    app.use(session({
      secret: process.env.SESSION_SECRET || 'your-secret-key',
      resave: false,
      saveUninitialized: false,
      store: store,
      cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 1 day
      }
    }));

    // Initialize Passport and restore authentication state from session
    app.use(passport.initialize());
    app.use(passport.session());

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100 // limit each IP to 100 requests per windowMs
    });
    app.use('/api/', limiter);

    // Health check endpoint
    app.get('/health', (req, res) => {
      const health = {
        uptime: process.uptime(),
        message: 'OK',
        timestamp: Date.now(),
        services: {
          mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
          redis: messageBroker.redis.status === 'ready' ? 'connected' : 'disconnected'
        }
      };
      res.json(health);
    });

    // Routes - MUST be after session and passport middleware
    app.use('/api/auth', authRoutes);
    app.use('/api/customers', customerRoutes);
    app.use('/api/orders', orderRoutes);
    app.use('/api/segmentation', segmentationRoutes);
    app.use('/api/campaigns', campaignRoutes);
    app.use('/api/delivery-receipt', deliveryReceiptRoutes);
    app.use('/api/segments', segmentRoutes);

    // Error handling
    app.use(errorHandler);
    const deliveryReceiptRouter = require('./routes/deliveryReceipt');
    app.use('/api/delivery-receipt', deliveryReceiptRouter); 
    const dashboardRouter = require('./routes/dashboard');
    app.use('/api/dashboard', dashboardRouter);
    
    // Verify Redis connection
    await messageBroker.redis.ping();
    console.log('Connected to Redis');

    // Start HTTP server
    const PORT = process.env.PORT || 4000;
    const server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      gracefulShutdown('UNCAUGHT_EXCEPTION');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      gracefulShutdown('UNHANDLED_REJECTION');
    });

  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
async function gracefulShutdown(signal) {
  console.log(`\n${signal} received. Starting graceful shutdown...`);
  
  try {
    // Close Redis connection
    await messageBroker.close();
    console.log('Redis connection closed');

    // Close MongoDB connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed');

    // Close HTTP server
    server.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });

    // Force close after 10 seconds
    setTimeout(() => {
      console.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
  } catch (error) {
    console.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
}

// Start the server
startServer(); 