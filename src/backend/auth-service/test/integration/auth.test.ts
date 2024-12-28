import { describe, test, expect, beforeAll, afterAll, jest } from '@jest/globals'; // version: ^29.0.0
import supertest from 'supertest'; // version: ^6.3.0
import nock from 'nock'; // version: ^13.0.0
import { GenericContainer, StartedTestContainer } from 'testcontainers'; // version: ^9.0.0
import { AuthService } from '../../src/services/auth.service';
import { AuthController } from '../../src/controllers/auth.controller';
import { Logger } from '../../../shared/utils/logger';
import express from 'express'; // version: ^4.18.0

// Test constants
const TEST_USER = {
  email: 'test@example.com',
  password: 'test123',
  roles: ['admin', 'manager', 'user']
};

const TEST_MFA_CODE = '123456';
const TEST_TIMEOUTS = {
  auth: 5000,
  mfa: 3000,
  token: 2000
};

interface TestEnvironment {
  postgresContainer: StartedTestContainer;
  redisContainer: StartedTestContainer;
  app: express.Application;
  authService: AuthService;
  cleanup: () => Promise<void>;
}

/**
 * Comprehensive integration test suite for authentication service
 */
describe('Auth Service Integration Tests', () => {
  let testEnv: TestEnvironment;
  let request: supertest.SuperTest<supertest.Test>;
  let mockAuth0Domain: string;

  beforeAll(async () => {
    // Setup test environment
    testEnv = await setupTestEnvironment();
    request = supertest(testEnv.app);
    mockAuth0Domain = 'test-tenant.auth0.com';

    // Configure Auth0 mocks
    setupAuth0Mocks(mockAuth0Domain);
  }, 30000);

  afterAll(async () => {
    await testEnv.cleanup();
    nock.cleanAll();
  });

  describe('Authentication Flows', () => {
    test('should successfully authenticate user with valid credentials', async () => {
      const response = await request
        .post('/api/auth/login')
        .send({
          email: TEST_USER.email,
          password: TEST_USER.password
        })
        .timeout(TEST_TIMEOUTS.auth);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('idToken');
      expect(response.body).toHaveProperty('expiresIn');
      expect(response.body.roles).toEqual(expect.arrayContaining(TEST_USER.roles));
      expect(response.headers['set-cookie']).toBeDefined();
    });

    test('should handle invalid credentials correctly', async () => {
      const response = await request
        .post('/api/auth/login')
        .send({
          email: TEST_USER.email,
          password: 'wrongpassword'
        })
        .timeout(TEST_TIMEOUTS.auth);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Authentication failed');
    });

    test('should enforce rate limiting', async () => {
      const attempts = Array(11).fill(null);
      const responses = await Promise.all(
        attempts.map(() =>
          request
            .post('/api/auth/login')
            .send({
              email: TEST_USER.email,
              password: TEST_USER.password
            })
        )
      );

      const lastResponse = responses[responses.length - 1];
      expect(lastResponse.status).toBe(429);
      expect(lastResponse.body.error).toContain('Too many requests');
    });
  });

  describe('MFA Validation', () => {
    test('should handle MFA challenge correctly', async () => {
      // First login to get MFA token
      const loginResponse = await request
        .post('/api/auth/login')
        .send({
          email: TEST_USER.email,
          password: TEST_USER.password
        });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body).toHaveProperty('mfaRequired', true);
      expect(loginResponse.body).toHaveProperty('mfaToken');

      // Validate MFA
      const mfaResponse = await request
        .post('/api/auth/mfa/validate')
        .send({
          userId: loginResponse.body.mfaToken,
          code: TEST_MFA_CODE
        })
        .timeout(TEST_TIMEOUTS.mfa);

      expect(mfaResponse.status).toBe(200);
      expect(mfaResponse.body).toHaveProperty('valid', true);
    });

    test('should reject invalid MFA codes', async () => {
      const response = await request
        .post('/api/auth/mfa/validate')
        .send({
          userId: 'valid-user-id',
          code: 'invalid-code'
        })
        .timeout(TEST_TIMEOUTS.mfa);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid MFA code');
    });

    test('should handle expired MFA challenges', async () => {
      jest.useFakeTimers();
      
      const loginResponse = await request
        .post('/api/auth/login')
        .send({
          email: TEST_USER.email,
          password: TEST_USER.password
        });

      // Advance time beyond MFA expiration
      jest.advanceTimersByTime(6 * 60 * 1000); // 6 minutes

      const mfaResponse = await request
        .post('/api/auth/mfa/validate')
        .send({
          userId: loginResponse.body.mfaToken,
          code: TEST_MFA_CODE
        });

      expect(mfaResponse.status).toBe(401);
      expect(mfaResponse.body.error).toContain('MFA challenge expired');

      jest.useRealTimers();
    });
  });

  describe('Token Management', () => {
    test('should refresh tokens successfully', async () => {
      // First login to get refresh token
      const loginResponse = await request
        .post('/api/auth/login')
        .send({
          email: TEST_USER.email,
          password: TEST_USER.password
        });

      const refreshResponse = await request
        .post('/api/auth/token/refresh')
        .send({
          refreshToken: loginResponse.body.refreshToken
        })
        .timeout(TEST_TIMEOUTS.token);

      expect(refreshResponse.status).toBe(200);
      expect(refreshResponse.body).toHaveProperty('idToken');
      expect(refreshResponse.body).toHaveProperty('expiresIn');
      expect(refreshResponse.headers['set-cookie']).toBeDefined();
    });

    test('should handle concurrent token refresh requests', async () => {
      const loginResponse = await request
        .post('/api/auth/login')
        .send({
          email: TEST_USER.email,
          password: TEST_USER.password
        });

      const refreshToken = loginResponse.body.refreshToken;
      const concurrentRequests = Array(3).fill(null).map(() =>
        request
          .post('/api/auth/token/refresh')
          .send({ refreshToken })
          .timeout(TEST_TIMEOUTS.token)
      );

      const responses = await Promise.all(concurrentRequests);
      const successfulResponses = responses.filter(r => r.status === 200);
      expect(successfulResponses.length).toBe(1);
    });

    test('should handle token revocation', async () => {
      const loginResponse = await request
        .post('/api/auth/login')
        .send({
          email: TEST_USER.email,
          password: TEST_USER.password
        });

      const logoutResponse = await request
        .post('/api/auth/logout')
        .set('Cookie', loginResponse.headers['set-cookie'])
        .timeout(TEST_TIMEOUTS.token);

      expect(logoutResponse.status).toBe(200);
      expect(logoutResponse.headers['set-cookie'][0]).toContain('Max-Age=0');
    });
  });
});

/**
 * Setup isolated test environment with containers
 */
async function setupTestEnvironment(): Promise<TestEnvironment> {
  // Start PostgreSQL container
  const postgresContainer = await new GenericContainer('postgres:14')
    .withEnvironment({
      POSTGRES_USER: 'test',
      POSTGRES_PASSWORD: 'test',
      POSTGRES_DB: 'auth_test'
    })
    .withExposedPorts(5432)
    .start();

  // Start Redis container
  const redisContainer = await new GenericContainer('redis:7')
    .withExposedPorts(6379)
    .start();

  // Setup Express app
  const app = express();
  app.use(express.json());

  // Initialize services
  const logger = new Logger({
    service: 'auth-service-test',
    environment: 'test'
  });

  const authService = new AuthService(
    {
      domain: 'test-tenant.auth0.com',
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret'
    },
    logger
  );

  const authController = new AuthController(authService);

  // Setup routes
  app.post('/api/auth/login', authController.login.bind(authController));
  app.post('/api/auth/mfa/validate', authController.validateMFA.bind(authController));
  app.post('/api/auth/token/refresh', authController.refreshToken.bind(authController));
  app.post('/api/auth/logout', authController.logout.bind(authController));

  return {
    postgresContainer,
    redisContainer,
    app,
    authService,
    cleanup: async () => {
      await postgresContainer.stop();
      await redisContainer.stop();
    }
  };
}

/**
 * Setup Auth0 API mocks
 */
function setupAuth0Mocks(domain: string): void {
  const auth0Scope = nock(`https://${domain}`);

  // Mock token endpoint
  auth0Scope
    .post('/oauth/token')
    .reply(200, {
      access_token: 'test-access-token',
      id_token: 'test-id-token',
      refresh_token: 'test-refresh-token',
      expires_in: 3600
    });

  // Mock userinfo endpoint
  auth0Scope
    .get('/userinfo')
    .reply(200, {
      sub: 'test-user-id',
      email: TEST_USER.email,
      email_verified: true
    });

  // Mock MFA endpoint
  auth0Scope
    .post('/mfa/challenge')
    .reply(200, {
      challenge_type: 'otp',
      otp_length: 6,
      binding_method: 'prompt'
    });

  // Mock MFA verification
  auth0Scope
    .post('/mfa/verify')
    .reply((uri, requestBody) => {
      const { code } = requestBody as { code: string };
      return code === TEST_MFA_CODE
        ? [200, { valid: true }]
        : [401, { error: 'Invalid MFA code' }];
    });
}