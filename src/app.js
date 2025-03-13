require('dotenv').config();
const express = require('express');
const connectDB = require('./config/database');
const gameRoutes = require('./routes/gameRoutes');
const steamRoutes = require('./routes/steamRoutes');
const updateService = require('./services/updateService');
const swaggerConfig = require('./config/swagger');
const logger = require('./utils/logger');

/**
 * Express application main entry point
 * Follows SOLID principles and clean code practices
 */
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connect to MongoDB
connectDB();

// API Documentation
app.use('/api-docs', swaggerConfig.serve, swaggerConfig.setup);

// Routes
app.use('/', gameRoutes);
app.use('/', steamRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    logger.error(`Server error: ${err.message}`);
    res.status(500).json({
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message
    });
});

app.listen(port, () => {
    logger.info(`Server running on port ${port}`);
    // Start update cron job
    updateService.startUpdateCron();
});

module.exports = app;
