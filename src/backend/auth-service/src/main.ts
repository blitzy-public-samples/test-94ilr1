// External dependencies
import express from 'express'; // version: ^4.18.0
import helmet from 'helmet'; // version: ^7.1.0
import cors from 'cors'; // version: ^2.8.5
import compression from 'compression'; // version: ^1.7.4
import rateLimit from 'express-rate-limit'; // version: ^7.1.0
import { Registry } from 'prom-client'; // version: ^14.2.0

// Internal imports
import { Auth0Config } from './config/auth0.config';
import { JWTMiddleware } from './middleware/jwt.middleware';
import { Logger } from '../../shared/utils/logger';
import { MetricsManager } from '../../shared/utils/metrics';
import { AuthService } from './services/auth.service';

// Environment variables with defaults
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';
const SHUTDOWN_TIMEOUT = parseInt(process.env.SHUTDOWN_TIMEOUT || '10000', 10);

/**
 * Enhanced authentication server class with comprehensive monitoring and security features
 */
class AuthServer {
  private readonly app: express.Application;
  private readonly logger: Logger;
  private readonly metrics: MetricsManager;
  private readonly auth0Config: Auth0Config;
  private readonly authService: AuthService;
  private server: any;

  constructor() {
    this.app = express();
    this.logger = new Logger({
      service: 'auth-service',
      component: 'AuthServer',
      environment: NODE_ENV
    });

    this.auth0Config = new Auth0Config(process.env);
    this.metrics = new MetricsManager({
      serviceName: 'auth-service',
      prefix: 'auth_service'
    });

    this.authService = new AuthService(this.auth0Config, this.logger);
  }

  /**
   * Configure security middleware stack
   */
  private setupMiddleware(): void {
    // Security headers
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          imgSrc: ["'self'"],
          connectSrc: ["'self'", this.auth0Config.domain],
          frameSrc: ["'none'"],
          objectSrc: ["'none'"]
        }
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    }));

    // CORS configuration
    this.app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
      maxAge: 86400 // 24 hours
    }));

    // Compression
    this.app.use(compression({
      level: 6,
      threshold: 1024
    }));

    // Request parsing
    this.app.use(express.json({ limit: '10kb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10kb' }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP, please try again later'
    });
    this.app.use('/api/', limiter);

    // JWT validation middleware
    const jwtMiddleware = new JWTMiddleware(this.auth0Config, this.authService);
    this.app.use('/api/protected', jwtMiddleware.createMiddleware());

    // Logging middleware
    this.app.use((req, res, next) => {
      const startTime = Date.now();
      res.on('finish', () => {
        this.logger.info('Request completed', {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration: Date.now() - startTime
        });
      });
      next();
    });
  }

  /**
   * Configure health check endpoints
   */
  private setupHealthCheck(): void {
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: NODE_ENV,
        version: process.env.npm_package_version
      });
    });

    this.app.get('/metrics', async (req, res) => {
      try {
        const metrics = await this.metrics.getMetrics();
        res.set('Content-Type', Registry.contentType);
        res.send(metrics);
      } catch (error) {
        this.logger.error('Error fetching metrics', error as Error);
        res.status(500).send('Error fetching metrics');
      }
    });
  }

  /**
   * Initialize the server with all configurations
   */
  public async initialize(): Promise<void> {
    try {
      // Validate Auth0 configuration
      this.auth0Config.validateConfig();

      // Setup middleware and routes
      this.setupMiddleware();
      this.setupHealthCheck();

      // Error handling middleware
      this.app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
        this.logger.error('Unhandled error', err);
        this.metrics.incrementCounter('unhandled_errors');
        res.status(500).json({
          error: 'Internal Server Error',
          message: NODE_ENV === 'development' ? err.message : 'An unexpected error occurred'
        });
      });

      // Start server
      this.server = this.app.listen(PORT, () => {
        this.logger.info(`Auth service started`, {
          port: PORT,
          environment: NODE_ENV
        });
      });

      // Setup graceful shutdown
      this.setupGracefulShutdown();
    } catch (error) {
      this.logger.error('Failed to initialize auth service', error as Error);
      throw error;
    }
  }

  /**
   * Configure graceful shutdown handling
   */
  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      this.logger.info(`Received ${signal}, starting graceful shutdown`);

      // Stop accepting new connections
      this.server.close(async () => {
        try {
          // Cleanup resources
          await Promise.race([
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Shutdown timeout')), SHUTDOWN_TIMEOUT)
            ),
            this.cleanup()
          ]);

          this.logger.info('Graceful shutdown completed');
          process.exit(0);
        } catch (error) {
          this.logger.error('Error during shutdown', error as Error);
          process.exit(1);
        }
      });
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }

  /**
   * Cleanup resources before shutdown
   */
  private async cleanup(): Promise<void> {
    // Add cleanup tasks here (e.g., closing database connections)
    this.logger.info('Cleaning up resources');
    // Implement actual cleanup logic
  }
}

// Create and export server instance
const authServer = new AuthServer();
export { authServer };

// Start server if running directly
if (require.main === module) {
  authServer.initialize().catch((error) => {
    console.error('Failed to start auth service:', error);
    process.exit(1);
  });
}