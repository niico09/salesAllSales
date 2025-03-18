require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/database');
const gameRoutes = require('./routes/gameRoutes');
const steamRoutes = require('./routes/steamRoutes');
const updateService = require('./services/updateService');
const swaggerConfig = require('./config/swagger');
const logger = require('./utils/logger');
const Game = require('./models/Game');

const app = express();
const port = process.env.PORT || 3000;

app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    message: 'Too many requests, please try again later.'
  }
});
app.use('/api', apiLimiter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

connectDB();

app.use('/api-docs', swaggerConfig.serve, swaggerConfig.setup);

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

app.use('/api/games', gameRoutes);
app.use('/api/steam', steamRoutes);

app.use((req, res, next) => {
  res.status(404).json({
    status: 'error',
    message: `Route ${req.originalUrl} not found`
  });
});

app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  
  logger.error(`Server error: ${err.message}`);
  logger.error(err.stack);
  
  res.status(statusCode).json({
    status: 'error',
    message: process.env.NODE_ENV === 'production' ? 
      'An unexpected error occurred' : 
      err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

const server = app.listen(port, () => {
  logger.info(`Server running on port ${port}`);
  
  Game.createIndexesInBackground();
  
  updateService.startUpdateCron();
});

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

function gracefulShutdown() {
  logger.info('Received shutdown signal, starting graceful shutdown');
  
  server.close(() => {
    logger.info('HTTP server closed');
    
    connectDB.disconnect()
      .then(() => {
        logger.info('Database connection closed');
        process.exit(0);
      })
      .catch(err => {
        logger.error(`Error during database disconnection: ${err.message}`);
        process.exit(1);
      });
  });
  
  setTimeout(() => {
    logger.error('Graceful shutdown timed out, forcing exit');
    process.exit(1);
  }, 30000);
}

module.exports = app;
