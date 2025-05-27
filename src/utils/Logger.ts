// src/utils/Logger.ts
import winston from 'winston';

// Define log levels and colors
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(logColors);

// Define the format for console logs
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `[${info.timestamp}] ${info.level}: ${info.message}`
  )
);

// Define the format for file logs
const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.json()
);

// Create the logger instance
const logger = winston.createLogger({
  levels: logLevels,
  format: winston.format.combine(winston.format.errors({ stack: true })),
  transports: [
    // Console transport (for development and general output)
    new winston.transports.Console({
      format: consoleFormat,
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    }),
    // File transport for all logs
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: fileFormat,
      level: 'debug',
    }),
    // File transport for error logs
    new winston.transports.File({
      filename: 'logs/error.log',
      format: fileFormat,
      level: 'error',
    }),
  ],
  exitOnError: false, // Do not exit on handled exceptions
});

// For convenience, we export the logger directly
export { logger as Logger };