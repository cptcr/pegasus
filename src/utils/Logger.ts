// src/utils/Logger.ts - Enhanced Logger with File Support
import fs from 'fs';
import path from 'path';
import { Config } from '../config/Config.js';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SUCCESS = 4
}

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  data?: any;
  stack?: string;
}

export class Logger {
  private logLevel: LogLevel;
  private logFile?: string;
  private logStream?: fs.WriteStream;

  constructor(level: string = Config.LOGGING.LEVEL) {
    this.logLevel = this.parseLogLevel(level);
    this.setupFileLogging();
  }

  /**
   * Parse log level string to enum
   */
  private parseLogLevel(level: string): LogLevel {
    switch (level.toLowerCase()) {
      case 'debug': return LogLevel.DEBUG;
      case 'info': return LogLevel.INFO;
      case 'warn': return LogLevel.WARN;
      case 'error': return LogLevel.ERROR;
      case 'success': return LogLevel.SUCCESS;
      default: return LogLevel.INFO;
    }
  }

  /**
   * Setup file logging if configured
   */
  private setupFileLogging(): void {
    if (Config.LOGGING.FILE) {
      try {
        const logDir = path.dirname(Config.LOGGING.FILE);
        if (!fs.existsSync(logDir)) {
          fs.mkdirSync(logDir, { recursive: true });
        }

        this.logFile = Config.LOGGING.FILE;
        this.logStream = fs.createWriteStream(this.logFile, { flags: 'a' });
        
        this.logStream.on('error', (error) => {
          console.error('Log file error:', error);
        });

      } catch (error) {
        console.error('Failed to setup file logging:', error);
      }
    }
  }

  /**
   * Log debug message
   */
  debug(message: string, data?: any): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  /**
   * Log info message
   */
  info(message: string, data?: any): void {
    this.log(LogLevel.INFO, message, data);
  }

  /**
   * Log warning message
   */
  warn(message: string, data?: any): void {
    this.log(LogLevel.WARN, message, data);
  }

  /**
   * Log error message
   */
  error(message: string, error?: any): void {
    let stack: string | undefined;
    let errorData: any = error;

    if (error instanceof Error) {
      stack = error.stack;
      errorData = {
        name: error.name,
        message: error.message,
        stack: error.stack
      };
    }

    this.log(LogLevel.ERROR, message, errorData, stack);
  }

  /**
   * Log success message
   */
  success(message: string, data?: any): void {
    this.log(LogLevel.SUCCESS, message, data);
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, message: string, data?: any, stack?: string): void {
    if (level < this.logLevel) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      data,
      stack
    };

    // Console output
    this.logToConsole(entry);

  /**
   * Core logging method
   */
  private log(level: LogLevel, message: string, data?: any, stack?: string): void {
    if (level < this.logLevel) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      data,
      stack
    };

    // Console output
    this.logToConsole(entry);

    // File output
    if (this.logStream) {
      this.logToFile(entry);
    }
  }

  /**
   * Log to console with colors
   */
  private logToConsole(entry: LogEntry): void {
    const timestamp = entry.timestamp.toISOString();
    const levelStr = LogLevel[entry.level].padEnd(7);
    
    let colorCode = '';
    let resetCode = '\x1b[0m';

    switch (entry.level) {
      case LogLevel.DEBUG:
        colorCode = '\x1b[36m'; // Cyan
        break;
      case LogLevel.INFO:
        colorCode = '\x1b[37m'; // White
        break;
      case LogLevel.WARN:
        colorCode = '\x1b[33m'; // Yellow
        break;
      case LogLevel.ERROR:
        colorCode = '\x1b[31m'; // Red
        break;
      case LogLevel.SUCCESS:
        colorCode = '\x1b[32m'; // Green
        break;
    }

    const logMessage = `${colorCode}[${timestamp}] [${levelStr}] ${entry.message}${resetCode}`;
    
    if (entry.level === LogLevel.ERROR) {
      console.error(logMessage);
      if (entry.data) {
        console.error('Data:', entry.data);
      }
      if (entry.stack) {
        console.error('Stack:', entry.stack);
      }
    } else {
      console.log(logMessage);
      if (entry.data && (entry.level === LogLevel.DEBUG || Config.DEV.VERBOSE_LOGGING)) {
        console.log('Data:', entry.data);
      }
    }
  }

  /**
   * Log to file
   */
  private logToFile(entry: LogEntry): void {
    try {
      const timestamp = entry.timestamp.toISOString();
      const levelStr = LogLevel[entry.level];
      
      let logLine = `[${timestamp}] [${levelStr}] ${entry.message}`;
      
      if (entry.data) {
        logLine += ` | Data: ${JSON.stringify(entry.data)}`;
      }
      
      if (entry.stack) {
        logLine += ` | Stack: ${entry.stack}`;
      }
      
      logLine += '\n';
      
      this.logStream?.write(logLine);
      
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  /**
   * Create child logger with context
   */
  child(context: string): ContextLogger {
    return new ContextLogger(this, context);
  }

  /**
   * Close log stream
   */
  close(): void {
    if (this.logStream) {
      this.logStream.end();
    }
  }

  /**
   * Rotate log files if they get too large
   */
  async rotateLogs(): Promise<void> {
    if (!this.logFile || !fs.existsSync(this.logFile)) {
      return;
    }

    try {
      const stats = fs.statSync(this.logFile);
      const maxSize = this.parseSize(Config.LOGGING.MAX_SIZE || '10mb');
      
      if (stats.size > maxSize) {
        // Close current stream
        if (this.logStream) {
          this.logStream.end();
        }

        // Rotate files
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const rotatedFile = this.logFile.replace(/\.log$/, `-${timestamp}.log`);
        
        fs.renameSync(this.logFile, rotatedFile);
        
        // Clean up old files
        await this.cleanupOldLogs();
        
        // Create new stream
        this.logStream = fs.createWriteStream(this.logFile, { flags: 'a' });
        
        this.info('Log file rotated', { rotatedTo: rotatedFile });
      }
      
    } catch (error) {
      console.error('Failed to rotate logs:', error);
    }
  }

  /**
   * Clean up old log files
   */
  private async cleanupOldLogs(): Promise<void> {
    if (!this.logFile) return;

    try {
      const logDir = path.dirname(this.logFile);
      const logBaseName = path.basename(this.logFile, '.log');
      const maxFiles = Config.LOGGING.MAX_FILES || 5;
      
      const files = fs.readdirSync(logDir)
        .filter(file => file.startsWith(logBaseName) && file.endsWith('.log') && file !== path.basename(this.logFile))
        .map(file => ({
          name: file,
          path: path.join(logDir, file),
          mtime: fs.statSync(path.join(logDir, file)).mtime
        }))
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
      
      // Remove old files beyond the limit
      if (files.length > maxFiles) {
        for (let i = maxFiles; i < files.length; i++) {
          fs.unlinkSync(files[i].path);
          this.debug('Deleted old log file', { file: files[i].name });
        }
      }
      
    } catch (error) {
      console.error('Failed to cleanup old logs:', error);
    }
  }

  /**
   * Parse size string to bytes
   */
  private parseSize(sizeStr: string): number {
    const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*(kb|mb|gb)?$/i);
    if (!match) return 10 * 1024 * 1024; // Default 10MB

    const value = parseFloat(match[1]);
    const unit = (match[2] || '').toLowerCase();

    switch (unit) {
      case 'kb': return value * 1024;
      case 'mb': return value * 1024 * 1024;
      case 'gb': return value * 1024 * 1024 * 1024;
      default: return value;
    }
  }

  /**
   * Get log statistics
   */
  getStats(): { logFile?: string; logLevel: string; fileSize?: number } {
    const stats: any = {
      logLevel: LogLevel[this.logLevel]
    };

    if (this.logFile) {
      stats.logFile = this.logFile;
      try {
        const fileStats = fs.statSync(this.logFile);
        stats.fileSize = fileStats.size;
      } catch (error) {
        // File doesn't exist or can't be accessed
      }
    }

    return stats;
  }
}

/**
 * Context logger that adds context to all log messages
 */
export class ContextLogger {
  constructor(private logger: Logger, private context: string) {}

  debug(message: string, data?: any): void {
    this.logger.debug(`[${this.context}] ${message}`, data);
  }

  info(message: string, data?: any): void {
    this.logger.info(`[${this.context}] ${message}`, data);
  }

  warn(message: string, data?: any): void {
    this.logger.warn(`[${this.context}] ${message}`, data);
  }

  error(message: string, error?: any): void {
    this.logger.error(`[${this.context}] ${message}`, error);
  }

  success(message: string, data?: any): void {
    this.logger.success(`[${this.context}] ${message}`, data);
  }

  child(subContext: string): ContextLogger {
    return new ContextLogger(this.logger, `${this.context}:${subContext}`);
  }
}

// Export singleton instance
export const logger = new Logger();

// Export LogLevel enum for external use
export { LogLevel };