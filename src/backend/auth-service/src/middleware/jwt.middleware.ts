import { Request, Response, NextFunction } from 'express'; // version: ^4.18.0
import jwt from 'jsonwebtoken'; // version: ^9.0.0
import jwksRsa from 'jwks-rsa'; // version: ^3.1.0
import { CircuitBreaker } from 'circuit-breaker-ts'; // version: ^1.0.0
import { Auth0Config } from '../config/auth0.config';
import { Logger } from '../../../shared/utils/logger';
import { AuthService } from '../services/auth.service';
import { Metrics } from '../../../shared/utils/metrics';

// Constants for token validation and security
const TOKEN_HEADER = 'Authorization';
const TOKEN_PREFIX = 'Bearer';
const JWKS_CACHE_TTL = 3600; // 1 hour cache for JWKS
const TOKEN_EXPIRY_GRACE_PERIOD = 30; // 30 seconds grace period
const ROLE_CACHE_TTL = 300; // 5 minutes role cache
const MAX_RETRIES = 3;

// Types for middleware configuration and token handling
interface MiddlewareOptions {
  requiredRoles?: string[];
  skipIfNoToken?: boolean;
  customClaimsValidation?: (decodedToken: any) => boolean;
}

interface DecodedToken {
  sub: string;
  iss: string;
  aud: string;
  exp: number;
  iat: number;
  scope?: string;
  permissions?: string[];
}

interface TokenCache {
  [key: string]: {
    roles: string[];
    timestamp: number;
  };
}

/**
 * Enterprise-grade JWT middleware class with comprehensive security features
 */
export class JWTMiddleware {
  private readonly jwksClient: jwksRsa.JwksClient;
  private readonly logger: Logger;
  private readonly metrics: Metrics;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly roleCache: TokenCache = {};
  private readonly tokenBlacklist: Set<string> = new Set();

  constructor(
    private readonly config: Auth0Config,
    private readonly authService: AuthService,
    private readonly options: MiddlewareOptions = {}
  ) {
    // Initialize JWKS client with caching and retry options
    this.jwksClient = jwksRsa({
      cache: true,
      cacheMaxAge: JWKS_CACHE_TTL * 1000,
      rateLimit: true,
      jwksRequestsPerMinute: 10,
      jwksUri: `https://${config.domain}/.well-known/jwks.json`,
      timeout: 5000,
      retry: {
        maxRetries: MAX_RETRIES,
        retryWhen: (error: Error) => {
          return error.name === 'NetworkError';
        },
      },
    });

    // Initialize logger and metrics
    this.logger = new Logger({
      service: 'auth-service',
      component: 'JWTMiddleware',
    });

    this.metrics = new MetricsManager({
      serviceName: 'auth-service',
      prefix: 'jwt_middleware',
    });

    // Initialize circuit breaker for JWKS requests
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      resetTimeout: 30000,
    });

    // Start token cleanup job
    this.startTokenCleanupJob();
  }

  /**
   * Extract and validate JWT token from request headers
   */
  private async extractToken(req: Request): Promise<string | null> {
    const startTime = Date.now();
    try {
      const authHeader = req.headers[TOKEN_HEADER.toLowerCase()];
      
      if (!authHeader || typeof authHeader !== 'string') {
        if (!this.options.skipIfNoToken) {
          throw new Error('No authorization token provided');
        }
        return null;
      }

      if (!authHeader.startsWith(TOKEN_PREFIX)) {
        throw new Error('Invalid token format');
      }

      const token = authHeader.slice(TOKEN_PREFIX.length + 1);
      
      // Check token blacklist
      if (this.tokenBlacklist.has(token)) {
        throw new Error('Token has been revoked');
      }

      return token;
    } catch (error) {
      this.logger.error('Token extraction failed', error as Error);
      this.metrics.incrementCounter('token_extraction_failures');
      throw error;
    } finally {
      this.metrics.recordHistogram(
        'token_extraction_duration',
        Date.now() - startTime
      );
    }
  }

  /**
   * Validate JWT token with comprehensive security checks
   */
  private async validateToken(token: string): Promise<DecodedToken> {
    const startTime = Date.now();
    try {
      // Get signing key using circuit breaker
      const getKey = async (header: jwt.JwtHeader) => {
        return await this.circuitBreaker.execute(async () => {
          const key = await this.jwksClient.getSigningKey(header.kid);
          return key.getPublicKey();
        });
      };

      // Verify token with Auth0 configuration
      const decodedToken = await new Promise<DecodedToken>((resolve, reject) => {
        jwt.verify(
          token,
          getKey,
          {
            algorithms: ['RS256'],
            issuer: `https://${this.config.domain}/`,
            audience: this.config.audience,
            clockTolerance: TOKEN_EXPIRY_GRACE_PERIOD,
          },
          (err, decoded) => {
            if (err) {
              reject(err);
            } else {
              resolve(decoded as DecodedToken);
            }
          }
        );
      });

      // Custom claims validation if provided
      if (this.options.customClaimsValidation &&
          !this.options.customClaimsValidation(decodedToken)) {
        throw new Error('Custom claims validation failed');
      }

      return decodedToken;
    } catch (error) {
      this.logger.error('Token validation failed', error as Error);
      this.metrics.incrementCounter('token_validation_failures');
      throw error;
    } finally {
      this.metrics.recordHistogram(
        'token_validation_duration',
        Date.now() - startTime
      );
    }
  }

  /**
   * Validate user roles with caching
   */
  private async validateRoles(userId: string, requiredRoles: string[]): Promise<boolean> {
    const startTime = Date.now();
    try {
      // Check role cache
      const cachedRoles = this.roleCache[userId];
      if (cachedRoles && Date.now() - cachedRoles.timestamp < ROLE_CACHE_TTL * 1000) {
        return this.authService.validateRoleHierarchy(cachedRoles.roles)
          .some(role => requiredRoles.includes(role));
      }

      // Get fresh roles from auth service
      const userRoles = await this.authService.getUserRoles(userId);
      
      // Update cache
      this.roleCache[userId] = {
        roles: userRoles,
        timestamp: Date.now(),
      };

      return userRoles.some(role => requiredRoles.includes(role));
    } catch (error) {
      this.logger.error('Role validation failed', error as Error);
      this.metrics.incrementCounter('role_validation_failures');
      throw error;
    } finally {
      this.metrics.recordHistogram(
        'role_validation_duration',
        Date.now() - startTime
      );
    }
  }

  /**
   * Create middleware function for JWT validation
   */
  public createMiddleware(): (req: Request, res: Response, next: NextFunction) => Promise<void> {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const startTime = Date.now();
      try {
        // Extract token
        const token = await this.extractToken(req);
        if (!token && this.options.skipIfNoToken) {
          return next();
        }

        // Validate token
        const decodedToken = await this.validateToken(token!);
        
        // Validate roles if required
        if (this.options.requiredRoles?.length) {
          const hasRequiredRole = await this.validateRoles(
            decodedToken.sub,
            this.options.requiredRoles
          );
          
          if (!hasRequiredRole) {
            throw new Error('Insufficient permissions');
          }
        }

        // Attach token info to request
        req.user = decodedToken;
        next();
      } catch (error) {
        this.logger.error('JWT middleware failed', error as Error);
        this.metrics.incrementCounter('middleware_failures');
        res.status(401).json({
          error: 'Unauthorized',
          message: (error as Error).message,
        });
      } finally {
        this.metrics.recordHistogram(
          'middleware_duration',
          Date.now() - startTime
        );
      }
    };
  }

  /**
   * Start cleanup job for expired tokens and cache
   */
  private startTokenCleanupJob(): void {
    setInterval(() => {
      const now = Date.now();
      
      // Clean role cache
      Object.entries(this.roleCache).forEach(([userId, cache]) => {
        if (now - cache.timestamp > ROLE_CACHE_TTL * 1000) {
          delete this.roleCache[userId];
        }
      });

      // Clean token blacklist (keep for 24 hours)
      this.tokenBlacklist.forEach(token => {
        try {
          jwt.decode(token);
        } catch {
          this.tokenBlacklist.delete(token);
        }
      });
    }, 60000); // Run every minute
  }
}

/**
 * Factory function to create JWT middleware instance
 */
export function createJWTMiddleware(
  config: Auth0Config,
  authService: AuthService,
  options?: MiddlewareOptions
): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  const middleware = new JWTMiddleware(config, authService, options);
  return middleware.createMiddleware();
}