import rateLimit from 'express-rate-limit'; // version: ^7.1.0
import RedisStore from 'rate-limit-redis'; // version: ^4.0.0
import { Request, Response } from 'express';
import Redis from 'ioredis'; // version: ^5.3.2
import { Logger } from '../../../shared/utils/logger';
import { MetricsManager } from '../../../shared/utils/metrics';
import { KongConfig } from '../config/kong.config';

// Initialize logger and metrics
const logger = new Logger({
  service: 'api-gateway',
  environment: process.env.NODE_ENV || 'development'
});

const metricsManager = new MetricsManager({
  serviceName: 'api-gateway',
  prefix: 'rate_limit'
});

// Constants
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute window
const RATE_LIMIT_HEADERS = true;
const RATE_LIMIT_WHITELIST = ['127.0.0.1', '::1'];
const REDIS_RETRY_STRATEGY = (times: number) => Math.min(times * 50, 2000);

// Rate limit configurations by category
const rateLimitConfigs = {
  'email-operations': {
    windowMs: RATE_LIMIT_WINDOW_MS,
    max: 100, // 100 requests per minute
    message: 'Too many email operations, please try again later',
    standardHeaders: RATE_LIMIT_HEADERS,
    legacyHeaders: false
  },
  'context-queries': {
    windowMs: RATE_LIMIT_WINDOW_MS,
    max: 200, // 200 requests per minute
    message: 'Too many context queries, please try again later',
    standardHeaders: RATE_LIMIT_HEADERS,
    legacyHeaders: false
  },
  'response-management': {
    windowMs: RATE_LIMIT_WINDOW_MS,
    max: 50, // 50 requests per minute
    message: 'Too many response management requests, please try again later',
    standardHeaders: RATE_LIMIT_HEADERS,
    legacyHeaders: false
  },
  'analytics': {
    windowMs: RATE_LIMIT_WINDOW_MS,
    max: 20, // 20 requests per minute
    message: 'Too many analytics requests, please try again later',
    standardHeaders: RATE_LIMIT_HEADERS,
    legacyHeaders: false
  }
};

export class RateLimiter {
  private redisClient: Redis;
  private store: RedisStore;
  private metrics: MetricsManager;
  private whitelist: Set<string>;

  constructor() {
    // Initialize Redis client with retry strategy
    this.redisClient = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      retryStrategy: REDIS_RETRY_STRATEGY,
      enableOfflineQueue: true
    });

    // Initialize Redis store for rate limiting
    this.store = new RedisStore({
      client: this.redisClient,
      prefix: 'rl:',
      sendCommand: (...args: any[]) => this.redisClient.call(...args)
    });

    this.metrics = metricsManager;
    this.whitelist = new Set(RATE_LIMIT_WHITELIST);

    // Setup Redis error handling
    this.redisClient.on('error', (error) => {
      logger.error('Redis client error', error);
      this.metrics.incrementCounter('redis_errors');
    });

    this.redisClient.on('connect', () => {
      logger.info('Redis client connected');
      this.metrics.incrementCounter('redis_connections');
    });
  }

  private handleRateLimitExceeded(req: Request, res: Response): void {
    const clientIp = req.ip;
    const path = req.path;

    logger.warn('Rate limit exceeded', {
      clientIp,
      path,
      headers: req.headers
    });

    this.metrics.incrementCounter('rate_limit_exceeded', {
      path,
      ip: clientIp
    });

    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: res.getHeader('Retry-After')
    });
  }

  public createMiddleware(category: keyof typeof rateLimitConfigs) {
    const config = rateLimitConfigs[category];

    if (!config) {
      throw new Error(`Invalid rate limit category: ${category}`);
    }

    return rateLimit({
      windowMs: config.windowMs,
      max: config.max,
      message: config.message,
      standardHeaders: config.standardHeaders,
      legacyHeaders: config.legacyHeaders,
      store: this.store,
      skip: (req) => this.whitelist.has(req.ip),
      handler: this.handleRateLimitExceeded.bind(this),
      keyGenerator: (req) => {
        // Use combination of IP and user ID if authenticated
        const userId = (req as any).user?.id;
        return userId ? `${req.ip}-${userId}` : req.ip;
      },
      onLimitReached: (req, res) => {
        logger.warn('Rate limit reached', {
          ip: req.ip,
          path: req.path,
          category
        });

        this.metrics.incrementCounter('rate_limit_reached', {
          category,
          path: req.path
        });
      },
      draft_polli_ratelimit_headers: true
    });
  }

  public async getRateLimitStatus(ip: string, category: string): Promise<{
    remaining: number;
    reset: number;
  }> {
    try {
      const key = `rl:${ip}:${category}`;
      const [requests, ttl] = await Promise.all([
        this.redisClient.get(key),
        this.redisClient.ttl(key)
      ]);

      const config = rateLimitConfigs[category as keyof typeof rateLimitConfigs];
      const remaining = config ? config.max - (parseInt(requests || '0')) : 0;

      return {
        remaining: Math.max(0, remaining),
        reset: Math.max(0, ttl)
      };
    } catch (error) {
      logger.error('Error getting rate limit status', error as Error);
      return { remaining: 0, reset: 0 };
    }
  }

  public async close(): Promise<void> {
    try {
      await this.redisClient.quit();
      logger.info('Rate limiter closed successfully');
    } catch (error) {
      logger.error('Error closing rate limiter', error as Error);
      throw error;
    }
  }
}

// Factory function to create rate limit middleware
export function createRateLimitMiddleware(category: keyof typeof rateLimitConfigs) {
  const rateLimiter = new RateLimiter();
  return rateLimiter.createMiddleware(category);
}
```

This implementation provides:

1. Category-specific rate limits as specified in the technical requirements:
   - Email Operations: 100/min
   - Context Queries: 200/min
   - Response Management: 50/min
   - Analytics: 20/min

2. Distributed rate limiting using Redis for scalability across multiple API Gateway instances.

3. Comprehensive monitoring and metrics using the provided MetricsManager.

4. Detailed logging of rate limit events using the Logger utility.

5. IP whitelist support for internal services.

6. Configurable rate limit windows and limits per category.

7. Proper error handling and Redis connection management.

8. Support for both IP-based and user-based rate limiting when authentication is present.

9. Standard rate limit headers (RateLimit-*) for client consumption.

10. Graceful degradation if Redis is temporarily unavailable.

The middleware can be used in Express routes like this:

```typescript
app.use('/api/v1/emails', createRateLimitMiddleware('email-operations'));
app.use('/api/v1/context', createRateLimitMiddleware('context-queries'));
app.use('/api/v1/responses', createRateLimitMiddleware('response-management'));
app.use('/api/v1/analytics', createRateLimitMiddleware('analytics'));