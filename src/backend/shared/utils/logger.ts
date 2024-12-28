import winston from 'winston'; // version: ^3.11.0
import ecsFormat from '@elastic/ecs-winston-format'; // version: ^1.3.1
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

// Define log levels with numeric priorities
export const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
} as const;

export const DEFAULT_LOG_LEVEL = 'info';

// Type definitions for configuration
interface LoggerConfig {
  level?: string;
  service?: string;
  environment?: string;
  retentionDays?: number;
  bufferSize?: number;
}

interface LogMetadata {
  correlationId?: string;
  requestId?: string;
  timestamp?: string;
  [key: string]: any;
}

// Buffer manager for high-volume logging
class LogBufferManager {
  private buffer: any[] = [];
  private readonly maxSize: number;
  private flushTimeout: NodeJS.Timeout | null = null;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }

  public add(log: any): void {
    this.buffer.push(log);
    if (this.buffer.length >= this.maxSize) {
      this.flush();
    } else if (!this.flushTimeout) {
      this.flushTimeout = setTimeout(() => this.flush(), 5000);
    }
  }

  public flush(): void {
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }
    // Implementation for bulk writing logs
    this.buffer = [];
  }
}

// Health monitoring for logging system
class LoggerHealthMonitor {
  private metrics: {
    errors: number;
    warnings: number;
    successfulLogs: number;
    failedLogs: number;
  };

  constructor() {
    this.metrics = {
      errors: 0,
      warnings: 0,
      successfulLogs: 0,
      failedLogs: 0,
    };
  }

  public trackLog(level: string, success: boolean): void {
    if (success) {
      this.metrics.successfulLogs++;
    } else {
      this.metrics.failedLogs++;
    }

    if (level === 'error') this.metrics.errors++;
    if (level === 'warn') this.metrics.warnings++;
  }

  public getMetrics() {
    return { ...this.metrics };
  }
}

export class Logger {
  private logger: winston.Logger;
  private correlationIds: Map<string, string>;
  private bufferManager: LogBufferManager;
  private healthMonitor: LoggerHealthMonitor;
  private readonly config: Required<LoggerConfig>;

  constructor(config: LoggerConfig) {
    this.config = {
      level: config.level || DEFAULT_LOG_LEVEL,
      service: config.service || 'unknown-service',
      environment: config.environment || 'development',
      retentionDays: config.retentionDays || 30,
      bufferSize: config.bufferSize || 1000,
    };

    this.correlationIds = new Map();
    this.bufferManager = new LogBufferManager(this.config.bufferSize);
    this.healthMonitor = new LoggerHealthMonitor();

    // Initialize Winston logger with ECS format
    this.logger = winston.createLogger({
      level: this.config.level,
      format: ecsFormat({ apmIntegration: true }),
      defaultMeta: {
        service: this.config.service,
        environment: this.config.environment,
      },
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.timestamp(),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
              return `${timestamp} [${level}] ${message} ${JSON.stringify(meta)}`;
            })
          ),
        }),
      ],
    });
  }

  private sanitizeMetadata(metadata: LogMetadata): LogMetadata {
    // Remove sensitive information
    const sanitized = { ...metadata };
    const sensitiveKeys = ['password', 'token', 'secret', 'key'];
    
    Object.keys(sanitized).forEach(key => {
      if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  public error(message: string, error?: Error, metadata: LogMetadata = {}): void {
    const enrichedMetadata = {
      ...this.sanitizeMetadata(metadata),
      timestamp: new Date().toISOString(),
      correlationId: this.correlationIds.get(metadata.requestId || ''),
      error: error ? {
        message: error.message,
        stack: error.stack,
        name: error.name,
      } : undefined,
    };

    try {
      this.logger.error(message, enrichedMetadata);
      this.healthMonitor.trackLog('error', true);
    } catch (loggingError) {
      this.bufferManager.add({ level: 'error', message, metadata: enrichedMetadata });
      this.healthMonitor.trackLog('error', false);
    }
  }

  public info(message: string, metadata: LogMetadata = {}): void {
    const enrichedMetadata = {
      ...this.sanitizeMetadata(metadata),
      timestamp: new Date().toISOString(),
      correlationId: this.correlationIds.get(metadata.requestId || ''),
    };

    try {
      this.logger.info(message, enrichedMetadata);
      this.healthMonitor.trackLog('info', true);
    } catch (loggingError) {
      this.bufferManager.add({ level: 'info', message, metadata: enrichedMetadata });
      this.healthMonitor.trackLog('info', false);
    }
  }

  public debug(message: string, metadata: LogMetadata = {}): void {
    const enrichedMetadata = {
      ...this.sanitizeMetadata(metadata),
      timestamp: new Date().toISOString(),
      correlationId: this.correlationIds.get(metadata.requestId || ''),
    };

    try {
      this.logger.debug(message, enrichedMetadata);
      this.healthMonitor.trackLog('debug', true);
    } catch (loggingError) {
      this.bufferManager.add({ level: 'debug', message, metadata: enrichedMetadata });
      this.healthMonitor.trackLog('debug', false);
    }
  }

  public setCorrelationId(requestId: string, correlationId: string): void {
    this.correlationIds.set(requestId, correlationId);
    // Cleanup correlation ID after 1 hour
    setTimeout(() => {
      this.correlationIds.delete(requestId);
    }, 3600000);
  }

  public getHealthMetrics() {
    return this.healthMonitor.getMetrics();
  }
}

export function createLogger(config: LoggerConfig): Logger {
  return new Logger(config);
}

export function createLoggerMiddleware(logger: Logger) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const requestId = uuidv4();
    const correlationId = req.headers['x-correlation-id'] as string || uuidv4();
    
    logger.setCorrelationId(requestId, correlationId);

    // Log request
    logger.info('Incoming request', {
      requestId,
      correlationId,
      method: req.method,
      url: req.url,
      headers: req.headers,
      query: req.query,
      body: req.body,
    });

    // Track response time
    const startTime = Date.now();

    // Intercept response
    const originalEnd = res.end;
    res.end = function(chunk?: any, encoding?: string | (() => void), cb?: () => void): void {
      const responseTime = Date.now() - startTime;
      
      logger.info('Request completed', {
        requestId,
        correlationId,
        statusCode: res.statusCode,
        responseTime,
      });

      originalEnd.call(this, chunk, encoding as string, cb);
    };

    // Error handling
    res.on('error', (error: Error) => {
      logger.error('Response error', error, {
        requestId,
        correlationId,
      });
    });

    next();
  };
}