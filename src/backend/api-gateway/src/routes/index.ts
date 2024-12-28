import express, { Router, Request, Response, NextFunction } from 'express'; // version: ^4.18.2
import cors from 'cors'; // version: ^2.8.5
import helmet from 'helmet'; // version: ^7.1.0
import { AuthMiddleware } from '../middleware/auth.middleware';
import { RateLimiter, createRateLimitMiddleware } from '../middleware/rate-limit.middleware';
import { Logger } from '../../../shared/utils/logger';
import { v4 as uuidv4 } from 'uuid'; // version: ^9.0.0

// Global constants
const API_VERSION = 'v1';
const CORS_OPTIONS = {
  origin: ['http://localhost:3000', 'https://*.company.com'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID'],
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining']
};

const RATE_LIMITS = {
  email: 100,
  context: 200,
  response: 50,
  analytics: 20
};

export class ApiRouter {
  private readonly router: Router;
  private readonly authMiddleware: AuthMiddleware;
  private readonly rateLimiter: RateLimiter;
  private readonly logger: Logger;

  constructor(authMiddleware: AuthMiddleware, rateLimiter: RateLimiter, logger: Logger) {
    this.router = express.Router();
    this.authMiddleware = authMiddleware;
    this.rateLimiter = rateLimiter;
    this.logger = logger;

    this.setupMiddleware();
    this.setupRoutes();
    this.setupHealthCheck();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    // Security middleware
    this.router.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"]
        }
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    }));

    // CORS configuration
    this.router.use(cors(CORS_OPTIONS));

    // Request parsing
    this.router.use(express.json({ limit: '10mb' }));
    this.router.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Correlation tracking
    this.router.use((req: Request, res: Response, next: NextFunction) => {
      const correlationId = req.headers['x-correlation-id'] as string || uuidv4();
      req.headers['x-correlation-id'] = correlationId;
      res.setHeader('x-correlation-id', correlationId);
      next();
    });

    // Request logging
    this.router.use((req: Request, res: Response, next: NextFunction) => {
      this.logger.info('Incoming request', {
        method: req.method,
        path: req.path,
        correlationId: req.headers['x-correlation-id']
      });
      next();
    });
  }

  private setupRoutes(): void {
    // Email operations routes
    this.router.use(
      `/api/${API_VERSION}/emails`,
      this.authMiddleware.authenticate,
      createRateLimitMiddleware('email-operations'),
      this.createEmailRoutes()
    );

    // Context queries routes
    this.router.use(
      `/api/${API_VERSION}/context`,
      this.authMiddleware.authenticate,
      createRateLimitMiddleware('context-queries'),
      this.createContextRoutes()
    );

    // Response management routes
    this.router.use(
      `/api/${API_VERSION}/responses`,
      this.authMiddleware.authenticate,
      createRateLimitMiddleware('response-management'),
      this.createResponseRoutes()
    );

    // Analytics routes
    this.router.use(
      `/api/${API_VERSION}/analytics`,
      this.authMiddleware.authenticate,
      createRateLimitMiddleware('analytics'),
      this.createAnalyticsRoutes()
    );
  }

  private setupHealthCheck(): void {
    // Liveness probe
    this.router.get('/health/live', (req: Request, res: Response) => {
      res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // Readiness probe
    this.router.get('/health/ready', async (req: Request, res: Response) => {
      try {
        // Check dependencies health
        const rateLimitStatus = await this.rateLimiter.getRateLimitStatus(req.ip, 'system');
        
        res.status(200).json({
          status: 'ok',
          timestamp: new Date().toISOString(),
          dependencies: {
            rateLimiter: rateLimitStatus.remaining >= 0 ? 'healthy' : 'degraded'
          }
        });
      } catch (error) {
        res.status(503).json({
          status: 'error',
          timestamp: new Date().toISOString(),
          message: 'Service unavailable'
        });
      }
    });
  }

  private setupErrorHandling(): void {
    // Global error handler
    this.router.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      const correlationId = req.headers['x-correlation-id'] as string;
      
      this.logger.error('Request error', err, {
        correlationId,
        path: req.path,
        method: req.method
      });

      res.status(500).json({
        error: 'Internal Server Error',
        correlationId,
        message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred'
      });
    });
  }

  private createEmailRoutes(): Router {
    const router = express.Router();

    router.get('/', async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Implementation handled by email service proxy
        next();
      } catch (error) {
        next(error);
      }
    });

    return router;
  }

  private createContextRoutes(): Router {
    const router = express.Router();

    router.post('/', async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Implementation handled by context service proxy
        next();
      } catch (error) {
        next(error);
      }
    });

    return router;
  }

  private createResponseRoutes(): Router {
    const router = express.Router();

    router.post('/', async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Implementation handled by response service proxy
        next();
      } catch (error) {
        next(error);
      }
    });

    return router;
  }

  private createAnalyticsRoutes(): Router {
    const router = express.Router();

    router.get('/', async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Implementation handled by analytics service proxy
        next();
      } catch (error) {
        next(error);
      }
    });

    return router;
  }

  public getRouter(): Router {
    return this.router;
  }
}

export default ApiRouter;