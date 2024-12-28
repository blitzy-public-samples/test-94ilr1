import { injectable, inject } from 'tsyringe'; // version: ^3.3.0
import { ManagementClient, AuthenticationClient } from 'auth0'; // version: ^4.0.0
import { RateLimiterMemory } from 'rate-limiter-flexible'; // version: ^2.4.1
import { Request } from 'express'; // version: ^4.18.0
import { Auth0Config } from '../config/auth0.config';
import { Logger } from '../../../shared/utils/logger';
import { createHash, randomBytes } from 'crypto';

// Types for authentication flows
interface AuthCredentials {
  email: string;
  password: string;
  mfaToken?: string;
}

interface AuthResult {
  accessToken: string;
  idToken: string;
  refreshToken: string;
  expiresIn: number;
  roles: string[];
  mfaRequired?: boolean;
  mfaToken?: string;
}

interface MFAChallenge {
  challengeId: string;
  token: string;
  expiresAt: number;
}

// Role hierarchy for RBAC
const ROLE_HIERARCHY: Record<string, string[]> = {
  admin: ['manager', 'user', 'guest'],
  manager: ['user', 'guest'],
  user: ['guest'],
  guest: []
};

// Security constants
const TOKEN_EXPIRY = 3600; // 1 hour
const MFA_ATTEMPT_LIMIT = 3;
const TOKEN_ROTATION_INTERVAL = 300; // 5 minutes

@injectable()
class AuthService {
  private authClient: AuthenticationClient;
  private managementClient: ManagementClient;
  private rateLimiter: RateLimiterMemory;
  private mfaChallenges: Map<string, MFAChallenge>;
  private tokenBlacklist: Set<string>;

  constructor(
    @inject('Auth0Config') private config: Auth0Config,
    @inject('Logger') private logger: Logger
  ) {
    // Initialize Auth0 clients
    const { management, authentication } = this.initializeAuth0Clients();
    this.authClient = authentication;
    this.managementClient = management;

    // Initialize rate limiter
    this.rateLimiter = new RateLimiterMemory({
      points: 10, // Number of attempts
      duration: 300, // Per 5 minutes
    });

    this.mfaChallenges = new Map();
    this.tokenBlacklist = new Set();

    // Start token cleanup job
    this.startTokenCleanupJob();
  }

  private initializeAuth0Clients() {
    const managementConfig = this.config.getManagementConfig();
    const authConfig = this.config.getAuthenticationConfig();

    return {
      management: new ManagementClient({
        domain: managementConfig.domain,
        clientId: managementConfig.clientId,
        clientSecret: managementConfig.clientSecret,
        scope: managementConfig.scope,
      }),
      authentication: new AuthenticationClient({
        domain: authConfig.domain,
        clientId: authConfig.clientId,
        clientSecret: authConfig.clientSecret,
      })
    };
  }

  /**
   * Authenticate user with enhanced security measures
   */
  public async authenticate(credentials: AuthCredentials): Promise<AuthResult> {
    try {
      // Rate limiting check
      await this.checkRateLimit(credentials.email);

      // Validate credentials
      const authResult = await this.validateCredentials(credentials);

      // Check if MFA is required
      if (authResult.mfaRequired && !credentials.mfaToken) {
        const mfaChallenge = await this.generateMFAChallenge(authResult.mfaToken!);
        return {
          ...authResult,
          mfaToken: mfaChallenge.token
        };
      }

      // Get user roles
      const roles = await this.getUserRoles(authResult.accessToken);

      // Log successful authentication
      this.logger.info('User authenticated successfully', {
        userId: authResult.accessToken,
        roles
      });

      return {
        ...authResult,
        roles
      };
    } catch (error) {
      this.logger.error('Authentication failed', error as Error, {
        email: credentials.email
      });
      throw error;
    }
  }

  /**
   * Validate MFA token with security measures
   */
  public async validateMFA(userId: string, code: string): Promise<boolean> {
    try {
      const challenge = this.mfaChallenges.get(userId);
      if (!challenge) {
        throw new Error('Invalid MFA challenge');
      }

      // Check challenge expiration
      if (Date.now() > challenge.expiresAt) {
        this.mfaChallenges.delete(userId);
        throw new Error('MFA challenge expired');
      }

      // Validate MFA code with timing-safe comparison
      const isValid = await this.authClient.guardian.validateToken({
        token: challenge.token,
        code
      });

      if (isValid) {
        this.mfaChallenges.delete(userId);
        this.logger.info('MFA validation successful', { userId });
        return true;
      }

      throw new Error('Invalid MFA code');
    } catch (error) {
      this.logger.error('MFA validation failed', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Get user roles with caching and validation
   */
  public async getUserRoles(accessToken: string): Promise<string[]> {
    try {
      const decodedToken = await this.verifyToken(accessToken);
      const userId = decodedToken.sub;

      const userRoles = await this.managementClient.getUserRoles({ id: userId });
      const roles = userRoles.map(role => role.name!);

      // Validate role hierarchy
      return this.validateRoleHierarchy(roles);
    } catch (error) {
      this.logger.error('Failed to get user roles', error as Error);
      throw error;
    }
  }

  /**
   * Generate secure MFA challenge
   */
  private async generateMFAChallenge(userId: string): Promise<MFAChallenge> {
    const challengeId = randomBytes(32).toString('hex');
    const token = await this.authClient.guardian.generateToken({
      userId
    });

    const challenge: MFAChallenge = {
      challengeId,
      token,
      expiresAt: Date.now() + (5 * 60 * 1000) // 5 minutes
    };

    this.mfaChallenges.set(userId, challenge);
    return challenge;
  }

  /**
   * Validate credentials against Auth0
   */
  private async validateCredentials(credentials: AuthCredentials): Promise<AuthResult> {
    try {
      const authResult = await this.authClient.oauth.passwordGrant({
        username: credentials.email,
        password: credentials.password,
        scope: 'openid profile email'
      });

      return {
        accessToken: authResult.access_token!,
        idToken: authResult.id_token!,
        refreshToken: authResult.refresh_token!,
        expiresIn: authResult.expires_in!,
        roles: [],
        mfaRequired: false
      };
    } catch (error) {
      this.logger.error('Credential validation failed', error as Error);
      throw error;
    }
  }

  /**
   * Check rate limiting status
   */
  private async checkRateLimit(key: string): Promise<void> {
    try {
      await this.rateLimiter.consume(key);
    } catch (error) {
      throw new Error('Rate limit exceeded');
    }
  }

  /**
   * Verify and validate JWT token
   */
  private async verifyToken(token: string): Promise<any> {
    if (this.tokenBlacklist.has(token)) {
      throw new Error('Token has been revoked');
    }

    try {
      return await this.authClient.tokens.verify({
        token,
        audience: this.config.getAuthenticationConfig().audience,
        issuer: this.config.getAuthenticationConfig().issuerBaseURL
      });
    } catch (error) {
      this.logger.error('Token verification failed', error as Error);
      throw error;
    }
  }

  /**
   * Validate role hierarchy
   */
  private validateRoleHierarchy(roles: string[]): string[] {
    const validatedRoles = new Set<string>();

    roles.forEach(role => {
      if (ROLE_HIERARCHY[role]) {
        validatedRoles.add(role);
        ROLE_HIERARCHY[role].forEach(inheritedRole => {
          validatedRoles.add(inheritedRole);
        });
      }
    });

    return Array.from(validatedRoles);
  }

  /**
   * Start token cleanup job
   */
  private startTokenCleanupJob(): void {
    setInterval(() => {
      const now = Date.now();
      this.tokenBlacklist.forEach(token => {
        try {
          this.verifyToken(token);
        } catch {
          this.tokenBlacklist.delete(token);
        }
      });
    }, TOKEN_ROTATION_INTERVAL * 1000);
  }
}

// Export the service
export { AuthService, AuthCredentials, AuthResult, MFAChallenge };