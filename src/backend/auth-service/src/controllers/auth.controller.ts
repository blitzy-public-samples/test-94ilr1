import { Request, Response } from 'express'; // version: ^4.18.0
import { injectable, inject } from 'tsyringe'; // version: ^3.3.0
import { RateLimiterMemory } from 'rate-limiter-flexible'; // version: ^2.4.1
import httpStatus from 'http-status'; // version: ^1.6.0
import { AuthService, AuthCredentials, AuthResult } from '../services/auth.service';
import { JWTMiddleware } from '../middleware/jwt.middleware';
import { Logger } from '../../../shared/utils/logger';
import { MetricsManager } from '../../../shared/utils/metrics';

// Security constants
const AUTH_COOKIE_NAME = 'auth_token';
const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  maxAge: 3600000,
  domain: 'domain.com',
  path: '/',
  signed: true,
} as const;

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
  windowMs: 900000, // 15 minutes
  max: 100, // Max 100 requests per windowMs
  message: 'Too many requests from this IP',
} as const;

@injectable()
export class AuthController {
  private readonly rateLimiter: RateLimiterMemory;
  private readonly metrics: MetricsManager;

  constructor(
    @inject('AuthService') private readonly authService: AuthService,
    @inject('JWTMiddleware') private readonly jwtMiddleware: JWTMiddleware,
    @inject('Logger') private readonly logger: Logger
  ) {
    // Initialize rate limiter
    this.rateLimiter = new RateLimiterMemory({
      points: RATE_LIMIT_CONFIG.max,
      duration: RATE_LIMIT_CONFIG.windowMs / 1000,
    });

    // Initialize metrics
    this.metrics = new MetricsManager({
      serviceName: 'auth-service',
      prefix: 'auth_controller',
    });
  }

  /**
   * Handle user login with enhanced security measures
   */
  public async login(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    try {
      // Rate limiting check
      await this.rateLimiter.consume(req.ip);

      // Validate request body
      const credentials: AuthCredentials = {
        email: req.body.email,
        password: req.body.password,
        mfaToken: req.body.mfaToken,
      };

      // Authenticate user
      const authResult: AuthResult = await this.authService.authenticate(credentials);

      // Handle MFA requirement
      if (authResult.mfaRequired && !credentials.mfaToken) {
        this.metrics.incrementCounter('mfa_required');
        res.status(httpStatus.OK).json({
          mfaRequired: true,
          mfaToken: authResult.mfaToken,
        });
        return;
      }

      // Set secure authentication cookie
      this.setAuthCookie(res, authResult.accessToken);

      // Log successful authentication
      this.logger.info('User authenticated successfully', {
        userId: authResult.accessToken,
        roles: authResult.roles,
      });

      this.metrics.incrementCounter('login_success');
      this.metrics.recordHistogram('login_duration', Date.now() - startTime);

      res.status(httpStatus.OK).json({
        idToken: authResult.idToken,
        expiresIn: authResult.expiresIn,
        roles: authResult.roles,
      });
    } catch (error) {
      this.handleAuthError(error as Error, 'login', res);
    }
  }

  /**
   * Validate MFA token with enhanced security
   */
  public async validateMFA(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    try {
      const { userId, code } = req.body;

      // Validate MFA code
      const isValid = await this.authService.validateMFA(userId, code);

      this.metrics.incrementCounter('mfa_validation', { success: String(isValid) });
      this.metrics.recordHistogram('mfa_validation_duration', Date.now() - startTime);

      if (isValid) {
        res.status(httpStatus.OK).json({ valid: true });
      } else {
        res.status(httpStatus.UNAUTHORIZED).json({
          error: 'Invalid MFA code',
        });
      }
    } catch (error) {
      this.handleAuthError(error as Error, 'mfa_validation', res);
    }
  }

  /**
   * Refresh authentication tokens with enhanced security
   */
  public async refreshToken(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    try {
      const refreshToken = req.body.refreshToken;

      // Validate and rotate refresh token
      const newTokens = await this.authService.refreshTokens(refreshToken);

      // Set new auth cookie
      this.setAuthCookie(res, newTokens.accessToken);

      this.metrics.incrementCounter('token_refresh_success');
      this.metrics.recordHistogram('token_refresh_duration', Date.now() - startTime);

      res.status(httpStatus.OK).json({
        idToken: newTokens.idToken,
        expiresIn: newTokens.expiresIn,
      });
    } catch (error) {
      this.handleAuthError(error as Error, 'token_refresh', res);
    }
  }

  /**
   * Handle user logout with secure session cleanup
   */
  public async logout(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    try {
      const token = req.cookies[AUTH_COOKIE_NAME];

      // Revoke tokens
      await this.authService.revokeTokens(token);

      // Clear auth cookie
      res.clearCookie(AUTH_COOKIE_NAME, {
        ...AUTH_COOKIE_OPTIONS,
        maxAge: 0,
      });

      this.metrics.incrementCounter('logout_success');
      this.metrics.recordHistogram('logout_duration', Date.now() - startTime);

      this.logger.info('User logged out successfully');
      res.status(httpStatus.OK).json({ message: 'Logged out successfully' });
    } catch (error) {
      this.handleAuthError(error as Error, 'logout', res);
    }
  }

  /**
   * Set secure authentication cookie
   */
  private setAuthCookie(res: Response, token: string): void {
    res.cookie(AUTH_COOKIE_NAME, token, AUTH_COOKIE_OPTIONS);
  }

  /**
   * Handle authentication errors with detailed logging
   */
  private handleAuthError(error: Error, operation: string, res: Response): void {
    this.logger.error(`Authentication error during ${operation}`, error);
    this.metrics.incrementCounter('auth_errors', { operation });

    const statusCode = error.message.includes('Rate limit')
      ? httpStatus.TOO_MANY_REQUESTS
      : httpStatus.UNAUTHORIZED;

    res.status(statusCode).json({
      error: 'Authentication failed',
      message: error.message,
    });
  }
}