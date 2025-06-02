require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoDBStore = require('connect-mongodb-session')(session);
const passport = require('./config/passport');
const rateLimit = require('express-rate-limit');
const { errorHandler } = require('./middleware/errorHandler');
const { logger } = require('./utils/logger');
// Comment out Redis for deployment
// const { redisClient, connectRedis } = require('./config/redis');

// Create express app
const app = express();

// Import routes
const authRoutes = require('./routes/auth');
const customerRoutes = require('./routes/customers');
const orderRoutes = require('./routes/orders');
const segmentationRoutes = require('./routes/segmentation');
const deliveryReceiptRoutes = require('./routes/deliveryReceipt');
const campaignRoutes = require('./routes/campaigns');
const segmentRoutes = require('./routes/segments');
const dashboardRoutes = require('./routes/dashboard');

// Initialize express app
const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/xenocrm';

// MongoDB connection options
const mongoOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  // Simplified SSL options for Render
  ssl: true,
  sslValidate: true,
  retryWrites: true,
  w: 'majority',
  // Remove problematic TLS options
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  family: 4 // Force IPv4
};

// Initialize connections and start server
async function startServer() {
  try {
    // Connect to MongoDB with updated options
    await mongoose.connect(MONGODB_URI, mongoOptions);
    console.log('Connected to MongoDB');

    // Comment out Redis for deployment
    // await connectRedis();
    // console.log('Connected to Redis');

    // Initialize session store with MongoDB
    const store = new MongoDBStore({
      uri: MONGODB_URI,
      collection: 'sessions',
      // Simplified connection options for session store
      connectionOptions: {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        ssl: true,
        sslValidate: true,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        family: 4
      }
    });

    // Handle store errors with better logging
    store.on('error', function(error) {
      console.error('Session store error:', {
        message: error.message,
        code: error.code,
        name: error.name,
        stack: error.stack
      });
    });

    // Basic middleware
    app.use(helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
      crossOriginOpenerPolicy: { policy: "unsafe-none" }
    }));

    // CORS configuration
    const corsOptions = {
      origin: process.env.FRONTEND_URL || 'https://crm-application-ictu.onrender.com',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      exposedHeaders: ['set-cookie']
    };
    app.use(cors(corsOptions));
    app.use(express.json());
    app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

    // Session middleware with Render-friendly settings
    app.use(session({
      secret: process.env.SESSION_SECRET || 'your-secret-key',
      resave: false,
      saveUninitialized: false,
      store: store,
      cookie: {
        secure: true, // Always use secure cookies in production
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 2 * 60 * 60 * 1000, // 2 hours
        domain: process.env.NODE_ENV === 'production' ? '.onrender.com' : undefined, // Allow sharing between subdomains
        path: '/'
      },
      rolling: true,
      name: 'xeno.sid',
      unset: 'destroy'
    }));

    // Add session cleanup middleware
    app.use((req, res, next) => {
      // Store the original end function
      const originalEnd = res.end;
      
      // Override the end function
      res.end = function(chunk, encoding) {
        // If this is a logout response, ensure session is destroyed
        if (req.path === '/api/auth/logout' && req.method === 'POST') {
          if (req.session) {
            req.session.destroy((err) => {
              if (err) console.error('Session destroy error:', err);
            });
          }
        }
        
        // Call the original end function
        originalEnd.call(this, chunk, encoding);
      };
      
      next();
    });

    // Initialize Passport
    app.use(passport.initialize());
    app.use(passport.session());

    // Add session check middleware
    app.use((req, res, next) => {
      if (req.isAuthenticated()) {
        const sessionAge = Date.now() - req.session.cookie.expires;
        // Force re-authentication if session is older than 2 hours
        if (sessionAge > 2 * 60 * 60 * 1000) {
          req.logout((err) => {
            if (err) return next(err);
            res.status(401).json({ 
              status: 'error',
              message: 'Session expired. Please login again.',
              code: 'SESSION_EXPIRED'
            });
          });
          return;
        }
      }
      next();
    });

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
          mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
        }
      };
      res.json(health);
    });

    // Routes
    app.use('/api/auth', authRoutes);
    app.use('/api/customers', customerRoutes);
    app.use('/api/orders', orderRoutes);
    app.use('/api/segmentation', segmentationRoutes);
    app.use('/api/campaigns', campaignRoutes);
    app.use('/api/delivery-receipt', deliveryReceiptRoutes);
    app.use('/api/segments', segmentRoutes);
    app.use('/api/dashboard', dashboardRoutes);

    // Error handling
    app.use(errorHandler);

    // Start server
    const server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal) => {
      console.log(`\n${signal} received. Starting graceful shutdown...`);
      
      try {
        await mongoose.connection.close();
        console.log('MongoDB connection closed');

        server.close(() => {
          console.log('HTTP server closed');
          process.exit(0);
        });

        setTimeout(() => {
          console.error('Could not close connections in time, forcefully shutting down');
          process.exit(1);
        }, 10000);
      } catch (error) {
        console.error('Error during graceful shutdown:', error);
        process.exit(1);
      }
    };

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

// Start the server
startServer(); 