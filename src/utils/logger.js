/**
 * Logger utility for application-wide logging
 * Follows clean code practices and provides descriptive log messages
 */

/**
 * Log levels
 * @enum {string}
 */
const LOG_LEVELS = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG'
};

/**
 * Current log level
 * Can be set via environment variable
 */
const currentLogLevel = process.env.LOG_LEVEL || LOG_LEVELS.INFO;

/**
 * Format log message with timestamp and level
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @returns {string} Formatted log message
 */
const formatLogMessage = (level, message) => {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level}] ${message}`;
};

/**
 * Log error message
 * @param {string} message - Error message
 */
const error = (message) => {
  console.error(formatLogMessage(LOG_LEVELS.ERROR, message));
};

/**
 * Log warning message
 * @param {string} message - Warning message
 */
const warn = (message) => {
  if ([LOG_LEVELS.WARN, LOG_LEVELS.INFO, LOG_LEVELS.DEBUG].includes(currentLogLevel)) {
    console.warn(formatLogMessage(LOG_LEVELS.WARN, message));
  }
};

/**
 * Log info message
 * @param {string} message - Info message
 */
const info = (message) => {
  if ([LOG_LEVELS.INFO, LOG_LEVELS.DEBUG].includes(currentLogLevel)) {
    console.info(formatLogMessage(LOG_LEVELS.INFO, message));
  }
};

/**
 * Log debug message
 * @param {string} message - Debug message
 */
const debug = (message) => {
  if (currentLogLevel === LOG_LEVELS.DEBUG) {
    console.debug(formatLogMessage(LOG_LEVELS.DEBUG, message));
  }
};

module.exports = {
  error,
  warn,
  info,
  debug,
  LOG_LEVELS
};
