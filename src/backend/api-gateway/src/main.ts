import express, { Express, Request, Response, NextFunction } from 'express'; // version: ^4.18.2
import helmet from 'helmet'; // version: ^7.1.0
import { Registry } from 'prom-client'; // version: ^14.2.0
import Redis from 'redis'; // version: ^4.6.10

import { KongConfig } from './config/kong.config';
import { AuthMiddleware } from './middleware/auth.middleware';
import { RateLimiter } from './middleware/rate-limit.middleware';
import { Logger } from '../../shared/utils/logger';
import { MetricsManager } from '../../shared/utils/metrics';

// Global constants
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const NODE_ENV = process.env.NODE_ENV || 'development';
const SHUTDOWN_TIMEOUT = process.env.SHUTDOWN_TIMEOUT || 10000;

class ApiGateway {
  private readonly app: Express;
  private readonly kongConfig: KongConfig;
  private readonly authMiddleware: AuthMiddleware;
  private readonly rateLimiter: RateLimiter;
  private readonly logger: Logger;
  private readonly metricsManager: MetricsManager;
  private server: any;
  private redis: Redis.RedisClient;

  constructor() {
    // Initialize core components
    this.app = express();
    this.logger = new Logger({
      service: 'api-gateway',
      environment: NODE_ENV
    });

    this.metricsManager = new MetricsManager({
      serviceName: 'api-gateway',
      prefix: 'gateway'
    });

    // Initialize Redis client
    this.redis = Redis.createClient({
      url: process.env.REDIS_URL,
      socket: {
        reconnectStrategy: (retries: number) => Math.min(retries * 50, 2000)
      }
    });

    // Initialize Kong configuration
    this.kongConfig = new KongConfig({
      services: {},
      routes: {},
      plugins: {}
    });

    // Initialize middleware
    this.authMiddleware = new AuthMiddleware(
      this.logger,
      this.kongConfig,
      this.redis as any
    );
    this.rateLimiter = new RateLimiter();
  }

  private async initialize(): Promise<void> {
    try {
      // Connect to Redis
      await this.redis.connect();

      // Basic security middleware
      this.app.use(helmet());
      this.app.use(express.json({ limit: '10mb' }));
      this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

      // Add correlation ID tracking
      this.app.use((req: Request, res: Response, next: NextFunction) => {
        const correlationId = req.headers['x-correlation-id'] || crypto.randomUUID();
        req.headers['x-correlation-id'] = correlationId;
        res.setHeader('x-correlation-id', correlationId);
        next();
      });

      // Configure rate limiting for different endpoints
      this.app.use('/api/v1/emails', this.rateLimiter.createMiddleware('email-operations'));
      this.app.use('/api/v1/context', this.rateLimiter.createMiddleware('context-queries'));
      this.app.use('/api/v1/responses', this.rateLimiter.createMiddleware('response-management'));
      this.app.use('/api/v1/analytics', this.rateLimiter.createMiddleware('analytics'));

      // Authentication middleware
      this.app.use('/api', this.authMiddleware.authenticate);

      // Health check endpoint
      this.app.get('/health', (req: Request, res: Response) => {
        res.json({ status: 'healthy', timestamp: new Date().toISOString() });
      });

      // Metrics endpoint
      this.app.get('/metrics', async (req: Request, res: Response) => {
        res.set('Content-Type', this.metricsManager['registry'].contentType);
        res.end(await this.metricsManager.getMetrics());
      });

      // Error handling middleware
      this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
        this.logger.error('Unhandled error', err, {
          path: req.path,
          method: req.method,
          correlationId: req.headers['x-correlation-id']
        });

        this.metricsManager.incrementCounter('unhandled_errors', {
          path: req.path,
          method: req.method
        });

        res.status(500).json({
          error: 'Internal Server Error',
          correlationId: req.headers['x-correlation-id']
        });
      });

      this.logger.info('API Gateway initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize API Gateway', error as Error);
      throw error;
    }
  }

  private async handleGracefulShutdown(): Promise<void> {
    this.logger.info('Initiating graceful shutdown');

    // Stop accepting new connections
    if (this.server) {
      this.server.close();
    }

    try {
      // Close Redis connection
      await this.redis.quit();

      // Close rate limiter
      await this.rateLimiter.close();

      // Wait for existing connections to complete
      await new Promise(resolve => setTimeout(resolve, SHUTDOWN_TIMEOUT));

      this.logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      this.logger.error('Error during shutdown', error as Error);
      process.exit(1);
    }
  }

  public async start(): Promise<void> {
    try {
      await this.initialize();

      this.server = this.app.listen(PORT, HOST, () => {
        this.logger.info(`API Gateway listening on ${HOST}:${PORT}`, {
          environment: NODE_ENV
        });
      });

      // Register shutdown handlers
      process.on('SIGTERM', () => this.handleGracefulShutdown());
      process.on('SIGINT', () => this.handleGracefulShutdown());

      // Start collecting metrics
      this.metricsManager.setGauge('server_start_time', Date.now());

    } catch (error) {
      this.logger.error('Failed to start API Gateway', error as Error);
      throw error;
    }
  }
}

// Create and start the API Gateway
const gateway = new ApiGateway();
gateway.start().catch(error => {
  console.error('Fatal error starting API Gateway:', error);
  process.exit(1);
});

export { ApiGateway };