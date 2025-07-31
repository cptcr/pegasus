import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { config } from '../config';
import { WebhookClient, EmbedBuilder } from 'discord.js';

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4,
}

interface LogContext {
  [key: string]: any;
}

interface LogEntry {
  timestamp: Date;
  level: string;
  message: string;
  context?: LogContext;
  error?: Error;
}

class Logger {
  private static instance: Logger;
  private logLevel: LogLevel;
  private logStreams: Map<string, NodeJS.WritableStream> = new Map();
  private errorWebhook?: WebhookClient;
  private auditWebhook?: WebhookClient;
  private logsDir: string;

  private constructor() {
    this.logLevel = this.parseLogLevel(config.LOG_LEVEL);
    this.logsDir = join(process.cwd(), 'logs');
    
    // Create logs directory if it doesn't exist
    if (!existsSync(this.logsDir)) {
      mkdirSync(this.logsDir, { recursive: true });
    }
    
    // Initialize webhooks if URLs are provided
    if (config.ERROR_WEBHOOK_URL) {
      this.errorWebhook = new WebhookClient({ url: config.ERROR_WEBHOOK_URL });
    }
    if (config.AUDIT_WEBHOOK_URL) {
      this.auditWebhook = new WebhookClient({ url: config.AUDIT_WEBHOOK_URL });
    }
    
    // Create log streams
    this.initializeLogStreams();
    
    // Handle process events
    this.setupProcessHandlers();
  }
  
  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }
  
  private parseLogLevel(level: string): LogLevel {
    const levels: Record<string, LogLevel> = {
      error: LogLevel.ERROR,
      warn: LogLevel.WARN,
      info: LogLevel.INFO,
      debug: LogLevel.DEBUG,
      trace: LogLevel.TRACE,
    };
    return levels[level.toLowerCase()] || LogLevel.INFO;
  }
  
  private initializeLogStreams(): void {
    const date = new Date().toISOString().split('T')[0];
    
    // Create streams for different log types
    const streams = ['combined', 'error', 'audit', 'performance'];
    
    streams.forEach(streamType => {
      const fileName = `${streamType}-${date}.log`;
      const filePath = join(this.logsDir, fileName);
      const stream = createWriteStream(filePath, { flags: 'a' });
      this.logStreams.set(streamType, stream);
    });
  }
  
  private formatLogEntry(entry: LogEntry): string {
    if (config.LOG_FORMAT === 'json') {
      return JSON.stringify({
        ...entry,
        timestamp: entry.timestamp.toISOString(),
        error: entry.error ? {
          message: entry.error.message,
          stack: entry.error.stack,
          name: entry.error.name,
        } : undefined,
      });
    }
    
    // Pretty format
    const timestamp = entry.timestamp.toISOString();
    const level = entry.level.padEnd(5);
    const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : '';
    const errorStr = entry.error ? `\n${entry.error.stack}` : '';
    
    return `[${timestamp}] ${level} ${entry.message}${contextStr}${errorStr}`;
  }
  
  private async writeToStream(streamName: string, entry: LogEntry): Promise<void> {
    const stream = this.logStreams.get(streamName);
    if (stream) {
      stream.write(this.formatLogEntry(entry) + '\n');
    }
  }
  
  private async sendWebhookNotification(entry: LogEntry, webhook: WebhookClient, color: number): Promise<void> {
    try {
      const embed = new EmbedBuilder()
        .setTitle(`${entry.level} Log`)
        .setDescription(entry.message)
        .setColor(color)
        .setTimestamp(entry.timestamp);
      
      if (entry.context) {
        embed.addFields([
          {
            name: 'Context',
            value: '```json\n' + JSON.stringify(entry.context, null, 2).slice(0, 1000) + '\n```',
            inline: false,
          }
        ]);
      }
      
      if (entry.error) {
        embed.addFields([
          {
            name: 'Error',
            value: '```\n' + entry.error.stack?.slice(0, 1000) + '\n```',
            inline: false,
          }
        ]);
      }
      
      await webhook.send({ embeds: [embed] });
    } catch (error) {
      console.error('Failed to send webhook notification:', error);
    }
  }
  
  private shouldLog(level: LogLevel): boolean {
    return level <= this.logLevel;
  }
  
  public error(message: string, error?: Error, context?: LogContext): void {
    if (!this.shouldLog(LogLevel.ERROR)) return;
    
    const entry: LogEntry = {
      timestamp: new Date(),
      level: 'ERROR',
      message,
      context,
      error,
    };
    
    // Write to console
    console.error(`[ERROR] ${message}`, error, context);
    
    // Write to files
    this.writeToStream('combined', entry);
    this.writeToStream('error', entry);
    
    // Send webhook notification
    if (this.errorWebhook) {
      this.sendWebhookNotification(entry, this.errorWebhook, 0xff0000);
    }
  }
  
  public warn(message: string, context?: LogContext): void {
    if (!this.shouldLog(LogLevel.WARN)) return;
    
    const entry: LogEntry = {
      timestamp: new Date(),
      level: 'WARN',
      message,
      context,
    };
    
    console.warn(`[WARN] ${message}`, context);
    this.writeToStream('combined', entry);
  }
  
  public info(message: string, context?: LogContext): void {
    if (!this.shouldLog(LogLevel.INFO)) return;
    
    const entry: LogEntry = {
      timestamp: new Date(),
      level: 'INFO',
      message,
      context,
    };
    
    console.info(`[INFO] ${message}`, context);
    this.writeToStream('combined', entry);
  }
  
  public debug(message: string, context?: LogContext): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;
    
    const entry: LogEntry = {
      timestamp: new Date(),
      level: 'DEBUG',
      message,
      context,
    };
    
    console.debug(`[DEBUG] ${message}`, context);
    this.writeToStream('combined', entry);
  }
  
  public trace(message: string, context?: LogContext): void {
    if (!this.shouldLog(LogLevel.TRACE)) return;
    
    const entry: LogEntry = {
      timestamp: new Date(),
      level: 'TRACE',
      message,
      context,
    };
    
    console.debug(`[TRACE] ${message}`, context);
    this.writeToStream('combined', entry);
  }
  
  public audit(action: string, userId: string, guildId: string, details: LogContext): void {
    const entry: LogEntry = {
      timestamp: new Date(),
      level: 'AUDIT',
      message: action,
      context: {
        userId,
        guildId,
        ...details,
      },
    };
    
    this.writeToStream('audit', entry);
    
    // Send audit webhook
    if (this.auditWebhook) {
      this.sendWebhookNotification(entry, this.auditWebhook, 0x0099ff);
    }
  }
  
  public performance(operation: string, duration: number, context?: LogContext): void {
    const entry: LogEntry = {
      timestamp: new Date(),
      level: 'PERF',
      message: operation,
      context: {
        duration,
        ...context,
      },
    };
    
    this.writeToStream('performance', entry);
    
    // Log slow operations as warnings
    if (duration > 1000) {
      this.warn(`Slow operation detected: ${operation}`, { duration, ...context });
    }
  }
  
  private setupProcessHandlers(): void {
    process.on('uncaughtException', (error) => {
      this.error('Uncaught Exception', error);
      process.exit(1);
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      this.error('Unhandled Rejection', reason as Error, { promise });
    });
    
    process.on('SIGTERM', () => {
      this.info('Received SIGTERM, closing log streams');
      this.closeStreams();
    });
    
    process.on('SIGINT', () => {
      this.info('Received SIGINT, closing log streams');
      this.closeStreams();
    });
  }
  
  private closeStreams(): void {
    this.logStreams.forEach((stream, name) => {
      stream.end();
    });
    this.logStreams.clear();
  }
  
  public child(context: LogContext): LoggerChild {
    return new LoggerChild(this, context);
  }
}

class LoggerChild {
  constructor(
    private parent: Logger,
    private context: LogContext
  ) {}
  
  private mergeContext(additionalContext?: LogContext): LogContext {
    return { ...this.context, ...additionalContext };
  }
  
  error(message: string, error?: Error, context?: LogContext): void {
    this.parent.error(message, error, this.mergeContext(context));
  }
  
  warn(message: string, context?: LogContext): void {
    this.parent.warn(message, this.mergeContext(context));
  }
  
  info(message: string, context?: LogContext): void {
    this.parent.info(message, this.mergeContext(context));
  }
  
  debug(message: string, context?: LogContext): void {
    this.parent.debug(message, this.mergeContext(context));
  }
  
  trace(message: string, context?: LogContext): void {
    this.parent.trace(message, this.mergeContext(context));
  }
}

// Performance tracking decorator
export function trackPerformance(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  
  descriptor.value = async function(...args: any[]) {
    const start = Date.now();
    const logger = Logger.getInstance();
    
    try {
      const result = await originalMethod.apply(this, args);
      const duration = Date.now() - start;
      
      logger.performance(`${target.constructor.name}.${propertyKey}`, duration, {
        args: args.length,
      });
      
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      logger.performance(`${target.constructor.name}.${propertyKey} (failed)`, duration, {
        args: args.length,
        error: (error as Error).message,
      });
      throw error;
    }
  };
  
  return descriptor;
}

// Export singleton instance
export const logger = Logger.getInstance();