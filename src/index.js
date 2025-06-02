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
      },
      // Add these options for better session handling
      autoRemove: 'interval',
      autoRemoveInterval: 10, // In minutes
      touchAfter: 24 * 3600, // time period in seconds
      ttl: 24 * 60 * 60 // 24 hours in seconds
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

    // CORS configuration with updated settings
    const corsOptions = {
      origin: process.env.FRONTEND_URL || 'https://crm-application-ictu.onrender.com',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'X-Requested-With'],
      exposedHeaders: ['Set-Cookie'],
      maxAge: 86400
    };

    // Apply security middleware
    app.set('trust proxy', 1); // trust first proxy
    app.use(cors(corsOptions));
    app.use(helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
      crossOriginOpenerPolicy: { policy: "unsafe-none" }
    }));
    app.use(express.json());
    app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

    // Session middleware with updated settings
    app.use(session({
      secret: process.env.SESSION_SECRET || 'your-secret-key',
      resave: false,
      saveUninitialized: false,
      store: store,
      proxy: true,
      rolling: true,
      cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 24 * 60 * 60 * 1000,
        path: '/',
        domain: process.env.NODE_ENV === 'production' ? '.onrender.com' : undefined
      },
      name: 'xeno.sid'
    }));

    // Add session verification middleware
    app.use((req, res, next) => {
      if (req.session && !req.session.initialized) {
        req.session.initialized = true;
        req.session.createdAt = Date.now();
      }
      
      // Refresh session on each request
      if (req.session) {
        req.session.touch();
      }

      next();
    });

    // Initialize Passport and restore authentication state from session
    app.use(passport.initialize());
    app.use(passport.session());

    // Add session debug middleware
    app.use((req, res, next) => {
      // Enhance logging for session debugging
      const logSessionDetails = () => {
        console.log('Session Debug:', {
          sessionID: req.sessionID,
          session: req.session,
          isAuthenticated: req.isAuthenticated(),
          user: req.user,
          cookies: req.cookies
        });
      };

      // Log session details
      logSessionDetails();

      // Wrap the original end method to log before response
      const originalEnd = res.end;
      res.end = function(...args) {
        logSessionDetails();
        return originalEnd.apply(this, args);
      };

      next();
    });

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