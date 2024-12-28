import { Request, Response, NextFunction } from 'express'; // version: ^4.18.0
import { verify, decode, JwtPayload } from 'jsonwebtoken'; // version: ^9.0.0
import { ManagementClient } from 'auth0'; // version: ^4.0.0
import Redis from 'ioredis'; // version: ^5.0.0
import { Logger } from '../../../shared/utils/logger';
import { KongConfig } from '../config/kong.config';
import { v4 as uuidv4 } from 'uuid'; // version: ^9.0.0

// Constants for token and cache management
const AUTH_CACHE_TTL = 300; // 5 minutes
const MAX_TOKEN_AGE = 3600; // 1 hour
const MAX_CACHE_SIZE = 10000;
const TOKEN_BLACKLIST_TTL = 86400; // 24 hours

// Types for token management
interface DecodedToken extends JwtPayload {
  permissions?: string[];
  roles?: string[];
  sub?: string;
}

interface TokenCacheEntry {
  decoded: DecodedToken;
  timestamp: number;
}

interface RateLimitEntry {
  count: number;
  timestamp: number;
}

export class AuthMiddleware {
  private readonly logger: Logger;
  private readonly kongConfig: KongConfig;
  private readonly tokenCache: Redis;
  private readonly auth0Client: ManagementClient;
  private readonly rateLimiter: Map<string, RateLimitEntry>;

  constructor(logger: Logger, kongConfig: KongConfig, redis: Redis) {
    this.logger = logger;
    this.kongConfig = kongConfig;
    this.tokenCache = redis;
    this.rateLimiter = new Map();

    // Initialize Auth0 management client
    this.auth0Client = new ManagementClient({
      domain: process.env.AUTH0_DOMAIN!,
      clientId: process.env.AUTH0_CLIENT_ID!,
      clientSecret: process.env.AUTH0_CLIENT_SECRET!,
    });
  }

  /**
   * Extract and validate JWT Bearer token from request
   */
  private async extractBearerToken(req: Request): Promise<string | null> {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return null;
      }

      const token = authHeader.split(' ')[1];
      if (!token || token.length > 4096) { // Prevent token length attacks
        return null;
      }

      // Validate token character set
      if (!/^[\w-]+\.[\w-]+\.[\w-]+$/.test(token)) {
        return null;
      }

      // Check token against blacklist
      const isBlacklisted = await this.tokenCache.get(`blacklist:${token}`);
      if (isBlacklisted) {
        return null;
      }

      return token;
    } catch (error) {
      this.logger.error('Token extraction failed', error as Error);
      return null;
    }
  }

  /**
   * Validate token with comprehensive security checks
   */
  private async validateToken(token: string): Promise<DecodedToken> {
    try {
      // Verify token signature and expiration
      const decoded = verify(token, process.env.AUTH0_PUBLIC_KEY!, {
        algorithms: ['RS256'],
        issuer: process.env.AUTH0_ISSUER,
        audience: process.env.AUTH0_AUDIENCE,
      }) as DecodedToken;

      // Validate required claims
      if (!decoded.sub || !decoded.permissions || !decoded.roles) {
        throw new Error('Invalid token claims');
      }

      // Check token freshness
      const tokenAge = (Date.now() / 1000) - decoded.iat!;
      if (tokenAge > MAX_TOKEN_AGE) {
        throw new Error('Token too old');
      }

      return decoded;
    } catch (error) {
      this.logger.error('Token validation failed', error as Error);
      throw error;
    }
  }

  /**
   * Express middleware for authentication
   */
  public authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const correlationId = uuidv4();
    req.headers['x-correlation-id'] = correlationId;

    try {
      // Rate limiting check
      const clientIp = req.ip;
      const rateLimitEntry = this.rateLimiter.get(clientIp) || { count: 0, timestamp: Date.now() };
      
      if (Date.now() - rateLimitEntry.timestamp > 60000) {
        rateLimitEntry.count = 0;
        rateLimitEntry.timestamp = Date.now();
      }
      
      if (rateLimitEntry.count > 100) { // 100 requests per minute
        throw new Error('Rate limit exceeded');
      }
      
      rateLimitEntry.count++;
      this.rateLimiter.set(clientIp, rateLimitEntry);

      // Extract and validate token
      const token = await this.extractBearerToken(req);
      if (!token) {
        throw new Error('Invalid or missing token');
      }

      // Check token cache
      const cachedToken = await this.tokenCache.get(`token:${token}`);
      if (cachedToken) {
        const parsed = JSON.parse(cachedToken) as TokenCacheEntry;
        if (Date.now() - parsed.timestamp < AUTH_CACHE_TTL * 1000) {
          req.user = parsed.decoded;
          return next();
        }
      }

      // Validate token
      const decoded = await this.validateToken(token);

      // Cache validated token
      const cacheEntry: TokenCacheEntry = {
        decoded,
        timestamp: Date.now(),
      };
      await this.tokenCache.setex(`token:${token}`, AUTH_CACHE_TTL, JSON.stringify(cacheEntry));

      // Attach user context to request
      req.user = decoded;

      // Set security headers
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

      // Log successful authentication
      this.logger.info('Authentication successful', {
        correlationId,
        userId: decoded.sub,
        roles: decoded.roles,
      });

      next();
    } catch (error) {
      this.logger.error('Authentication failed', error as Error, {
        correlationId,
        ip: req.ip,
        path: req.path,
      });

      res.status(401).json({
        error: 'Authentication failed',
        correlationId,
      });
    }
  };
}

export default AuthMiddleware;