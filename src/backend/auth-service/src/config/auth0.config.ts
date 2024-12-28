import { z } from 'zod'; // version: ^3.22.0
import { ManagementClient, AuthenticationClient } from 'auth0'; // version: ^4.0.0
import { Logger } from '../../shared/utils/logger';

// Global constants for token and security configuration
const DEFAULT_TOKEN_EXPIRY = 3600; // 1 hour in seconds
const DEFAULT_SCOPE = 'openid profile email';
const MIN_TOKEN_EXPIRY = 300; // 5 minutes minimum
const MAX_TOKEN_EXPIRY = 86400; // 24 hours maximum

// Zod schema for strict runtime validation of Auth0 configuration
export const auth0ConfigSchema = z.object({
  domain: z.string().url().startsWith('https://', { message: 'Domain must use HTTPS' }),
  clientId: z.string().min(20, { message: 'Client ID must be at least 20 characters' }),
  clientSecret: z.string().min(32, { message: 'Client secret must be at least 32 characters' }),
  audience: z.string().url(),
  issuerBaseURL: z.string().url().startsWith('https://', { message: 'Issuer URL must use HTTPS' }),
  tokenExpiry: z.number()
    .min(MIN_TOKEN_EXPIRY)
    .max(MAX_TOKEN_EXPIRY)
    .default(DEFAULT_TOKEN_EXPIRY),
  allowedScopes: z.array(z.string()).default([DEFAULT_SCOPE]),
  enableMFA: z.boolean().default(true),
  rateLimit: z.object({
    maxAttempts: z.number().min(1).max(100).default(10),
    windowMs: z.number().min(1000).max(3600000).default(300000), // 5 minutes
  }).default({}),
  retryPolicy: z.object({
    maxRetries: z.number().min(0).max(5).default(3),
    backoffMs: z.number().min(100).max(10000).default(1000),
  }).default({}),
});

// Type inference from the Zod schema
type Auth0ConfigType = z.infer<typeof auth0ConfigSchema>;

// Secure configuration validation function
function validateConfig(config: unknown): boolean {
  try {
    auth0ConfigSchema.parse(config);
    return true;
  } catch (error) {
    Logger.error('Auth0 configuration validation failed', error as Error, {
      component: 'Auth0Config',
      action: 'validate',
    });
    throw new Error('Invalid Auth0 configuration');
  }
}

// Cache for Auth0 client instances
const clientCache = new Map<string, { management: ManagementClient; authentication: AuthenticationClient }>();

/**
 * Factory function to create Auth0 client instances with caching
 * @param config Validated Auth0 configuration
 * @returns Object containing management and authentication clients
 */
export function createAuth0Clients(config: Auth0ConfigType) {
  const cacheKey = `${config.domain}:${config.clientId}`;
  
  if (clientCache.has(cacheKey)) {
    return clientCache.get(cacheKey)!;
  }

  const managementClient = new ManagementClient({
    domain: config.domain,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    scope: 'read:users update:users',
    retry: {
      enabled: true,
      maxRetries: config.retryPolicy.maxRetries,
    },
  });

  const authenticationClient = new AuthenticationClient({
    domain: config.domain,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
  });

  const clients = { management: managementClient, authentication: authenticationClient };
  clientCache.set(cacheKey, clients);

  return clients;
}

/**
 * Auth0 configuration class with enhanced security features and runtime validation
 */
@sealed
export class Auth0Config {
  private readonly logger: Logger;
  private readonly config: Auth0ConfigType;

  constructor(env: NodeJS.ProcessEnv) {
    this.logger = new Logger({
      service: 'auth-service',
      component: 'Auth0Config',
    });

    // Initialize configuration from environment variables with validation
    const config = {
      domain: env.AUTH0_DOMAIN!,
      clientId: env.AUTH0_CLIENT_ID!,
      clientSecret: env.AUTH0_CLIENT_SECRET!,
      audience: env.AUTH0_AUDIENCE!,
      issuerBaseURL: env.AUTH0_ISSUER_BASE_URL!,
      tokenExpiry: parseInt(env.AUTH0_TOKEN_EXPIRY || String(DEFAULT_TOKEN_EXPIRY)),
      allowedScopes: env.AUTH0_ALLOWED_SCOPES?.split(',') || [DEFAULT_SCOPE],
      enableMFA: env.AUTH0_ENABLE_MFA?.toLowerCase() === 'true',
      rateLimit: {
        maxAttempts: parseInt(env.AUTH0_RATE_LIMIT_MAX_ATTEMPTS || '10'),
        windowMs: parseInt(env.AUTH0_RATE_LIMIT_WINDOW_MS || '300000'),
      },
      retryPolicy: {
        maxRetries: parseInt(env.AUTH0_RETRY_MAX_RETRIES || '3'),
        backoffMs: parseInt(env.AUTH0_RETRY_BACKOFF_MS || '1000'),
      },
    };

    // Validate configuration
    if (!validateConfig(config)) {
      throw new Error('Invalid Auth0 configuration');
    }

    this.config = config;
    this.logger.info('Auth0 configuration initialized successfully');
  }

  /**
   * Returns secure configuration for Auth0 Management API
   */
  public getManagementConfig() {
    return {
      domain: this.config.domain,
      clientId: this.config.clientId,
      clientSecret: this.config.clientSecret,
      audience: `https://${this.config.domain}/api/v2/`,
      scope: 'read:users update:users',
      retry: this.config.retryPolicy,
    };
  }

  /**
   * Returns secure configuration for Auth0 Authentication API
   */
  public getAuthenticationConfig() {
    return {
      domain: this.config.domain,
      clientId: this.config.clientId,
      clientSecret: this.config.clientSecret,
      audience: this.config.audience,
      issuerBaseURL: this.config.issuerBaseURL,
      tokenExpiry: this.config.tokenExpiry,
      allowedScopes: this.config.allowedScopes,
      enableMFA: this.config.enableMFA,
      rateLimit: this.config.rateLimit,
    };
  }

  // Getters for essential properties
  public get domain(): string {
    return this.config.domain;
  }

  public get clientId(): string {
    return this.config.clientId;
  }
}

// Decorator for sealing the class
function sealed(constructor: Function) {
  Object.seal(constructor);
  Object.seal(constructor.prototype);
}