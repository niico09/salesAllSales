const mongoose = require('mongoose');
const logger = require('../utils/logger');

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/salesAllSales';

const mongoOptions = {
  maxPoolSize: parseInt(process.env.MONGO_MAX_POOL_SIZE || '10', 10),
  minPoolSize: parseInt(process.env.MONGO_MIN_POOL_SIZE || '5', 10),
  
  connectTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  
  retryWrites: true,
  retryReads: true,
  
  serverSelectionTimeoutMS: 5000,
  
  heartbeatFrequencyMS: 10000,
  
  // Eliminamos estas opciones obsoletas que generan advertencias en MongoDB Driver 4.0+
  //   useNewUrlParser: true,
  //   useUnifiedTopology: true,
  
  autoIndex: false
};

let isConnected = false;
let retryCount = 0;
const maxRetries = parseInt(process.env.MONGO_MAX_RETRIES || '5', 10);
const retryInterval = parseInt(process.env.MONGO_RETRY_INTERVAL || '5000', 10);

const connectDB = async () => {
  if (isConnected) {
    logger.info('Using existing database connection');
    return mongoose.connection;
  }
  
  try {
    logger.info(`Connecting to MongoDB at: ${mongoUri}`);
    await mongoose.connect(mongoUri, mongoOptions);
    
    isConnected = true;
    retryCount = 0;
    
    mongoose.connection.on('error', (err) => {
      logger.error(`MongoDB connection error: ${err.message}`);
      if (isConnected) {
        isConnected = false;
        retryConnection();
      }
    });
    
    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
      if (isConnected) {
        isConnected = false;
        retryConnection();
      }
    });
    
    logger.info('Connected to MongoDB successfully');
    return mongoose.connection;
  } catch (err) {
    logger.error(`Error connecting to MongoDB: ${err.message}`);
    
    if (retryCount < maxRetries) {
      retryCount++;
      logger.info(`Retrying connection (${retryCount}/${maxRetries}) in ${retryInterval}ms...`);
      
      return new Promise((resolve) => {
        setTimeout(async () => {
          resolve(await connectDB());
        }, retryInterval);
      });
    }
    
    logger.error(`Failed to connect to MongoDB after ${maxRetries} attempts`);
    process.exit(1);
  }
};

const retryConnection = () => {
  if (retryCount < maxRetries) {
    retryCount++;
    
    setTimeout(async () => {
      logger.info(`Attempting to reconnect to MongoDB (${retryCount}/${maxRetries})...`);
      try {
        await mongoose.connect(mongoUri, mongoOptions);
        isConnected = true;
        retryCount = 0;
        logger.info('Reconnected to MongoDB successfully');
      } catch (err) {
        logger.error(`Failed to reconnect: ${err.message}`);
        retryConnection();
      }
    }, retryInterval);
  } else {
    logger.error(`Failed to reconnect to MongoDB after ${maxRetries} attempts`);
  }
};

connectDB.disconnect = async () => {
  if (!isConnected) {
    logger.info('No active connection to disconnect');
    return;
  }
  
  try {
    await mongoose.disconnect();
    isConnected = false;
    logger.info('Disconnected from MongoDB');
  } catch (err) {
    logger.error(`Error disconnecting from MongoDB: ${err.message}`);
    throw err;
  }
};

module.exports = connectDB;
