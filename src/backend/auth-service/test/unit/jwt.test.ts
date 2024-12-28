import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'; // version: ^29.0.0
import jwt from 'jsonwebtoken'; // version: ^9.0.0
import nock from 'nock'; // version: ^13.0.0
import { JWTMiddleware } from '../../src/middleware/jwt.middleware';
import { Auth0Config } from '../../src/config/auth0.config';
import { Logger } from '../../../shared/utils/logger';
import { Metrics } from '../../../shared/utils/metrics';
import { Request, Response, NextFunction } from 'express';

// Test constants
const TEST_DOMAIN = 'test.auth0.com';
const TEST_AUDIENCE = 'https://api.test.com';
const TEST_USER_ID = 'test-user-123';
const TEST_ROLES = ['admin', 'user'];
const TEST_KID = 'test-key-id';

// Mock implementations
jest.mock('../../../shared/utils/logger');
jest.mock('../../../shared/utils/metrics');

describe('JWTMiddleware', () => {
  let jwtMiddleware: JWTMiddleware;
  let mockConfig: Auth0Config;
  let mockAuthService: any;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let mockLogger: jest.Mocked<Logger>;
  let mockMetrics: jest.Mocked<Metrics>;

  beforeEach(() => {
    // Reset nock interceptors
    nock.cleanAll();

    // Initialize mocks
    mockConfig = {
      domain: TEST_DOMAIN,
      audience: TEST_AUDIENCE,
      getAuthenticationConfig: () => ({
        domain: TEST_DOMAIN,
        audience: TEST_AUDIENCE,
      }),
    } as Auth0Config;

    mockAuthService = {
      validateRoleHierarchy: jest.fn(),
      getUserRoles: jest.fn(),
    };

    mockRequest = {
      headers: {},
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    mockNext = jest.fn();

    mockLogger = new Logger({
      service: 'auth-service',
      component: 'JWTMiddleware',
    }) as jest.Mocked<Logger>;

    mockMetrics = new Metrics({
      serviceName: 'auth-service',
      prefix: 'jwt_middleware',
    }) as jest.Mocked<Metrics>;

    // Initialize JWT middleware
    jwtMiddleware = new JWTMiddleware(mockConfig, mockAuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Token Validation', () => {
    test('should validate a valid JWT token', async () => {
      // Generate test token
      const token = generateTestToken({
        sub: TEST_USER_ID,
        aud: TEST_AUDIENCE,
        iss: `https://${TEST_DOMAIN}/`,
      });

      // Mock JWKS endpoint
      mockJWKSEndpoint([{
        kid: TEST_KID,
        kty: 'RSA',
        use: 'sig',
        n: 'test-modulus',
        e: 'test-exponent',
      }]);

      // Setup request with token
      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      // Execute middleware
      const middleware = jwtMiddleware.createMiddleware();
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Verify successful validation
      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.user).toBeDefined();
      expect(mockRequest.user?.sub).toBe(TEST_USER_ID);
    });

    test('should reject expired tokens', async () => {
      // Generate expired token
      const token = generateTestToken({
        sub: TEST_USER_ID,
        exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
      });

      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      const middleware = jwtMiddleware.createMiddleware();
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Unauthorized',
          message: expect.stringContaining('expired'),
        })
      );
    });

    test('should handle missing authorization header', async () => {
      const middleware = jwtMiddleware.createMiddleware();
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Unauthorized',
          message: 'No authorization token provided',
        })
      );
    });
  });

  describe('Role-Based Access Control', () => {
    test('should validate required roles successfully', async () => {
      const token = generateTestToken({
        sub: TEST_USER_ID,
        permissions: ['read:users', 'write:users'],
      });

      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      mockAuthService.getUserRoles.mockResolvedValue(TEST_ROLES);
      mockAuthService.validateRoleHierarchy.mockReturnValue(TEST_ROLES);

      const middleware = jwtMiddleware.createMiddleware({
        requiredRoles: ['user'],
      });

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockAuthService.getUserRoles).toHaveBeenCalledWith(TEST_USER_ID);
    });

    test('should reject insufficient roles', async () => {
      const token = generateTestToken({
        sub: TEST_USER_ID,
      });

      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      mockAuthService.getUserRoles.mockResolvedValue(['guest']);
      mockAuthService.validateRoleHierarchy.mockReturnValue(['guest']);

      const middleware = jwtMiddleware.createMiddleware({
        requiredRoles: ['admin'],
      });

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Unauthorized',
          message: 'Insufficient permissions',
        })
      );
    });
  });

  describe('Security Features', () => {
    test('should detect token replay attacks', async () => {
      const token = generateTestToken({
        sub: TEST_USER_ID,
        jti: 'unique-token-id',
      });

      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      const middleware = jwtMiddleware.createMiddleware();

      // First request should succeed
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();

      // Reset mocks
      jest.clearAllMocks();

      // Second request with same token should fail
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Unauthorized',
          message: 'Token has been revoked',
        })
      );
    });

    test('should validate token signature', async () => {
      const invalidToken = jwt.sign(
        { sub: TEST_USER_ID },
        'invalid-secret',
        { algorithm: 'HS256' }
      );

      mockRequest.headers = {
        authorization: `Bearer ${invalidToken}`,
      };

      const middleware = jwtMiddleware.createMiddleware();
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Unauthorized',
          message: expect.stringContaining('invalid signature'),
        })
      );
    });
  });

  describe('Monitoring and Metrics', () => {
    test('should record validation metrics', async () => {
      const token = generateTestToken({
        sub: TEST_USER_ID,
      });

      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      const middleware = jwtMiddleware.createMiddleware();
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockMetrics.recordHistogram).toHaveBeenCalledWith(
        'token_validation_duration',
        expect.any(Number)
      );
    });

    test('should log validation failures', async () => {
      const invalidToken = 'invalid-token';

      mockRequest.headers = {
        authorization: `Bearer ${invalidToken}`,
      };

      const middleware = jwtMiddleware.createMiddleware();
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Token validation failed',
        expect.any(Error),
        expect.any(Object)
      );
    });
  });
});

// Helper functions
function generateTestToken(claims: object): string {
  const privateKey = Buffer.from('test-private-key');
  return jwt.sign(
    {
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      ...claims,
    },
    privateKey,
    {
      algorithm: 'RS256',
      keyid: TEST_KID,
    }
  );
}

function mockJWKSEndpoint(keys: any[]) {
  nock(`https://${TEST_DOMAIN}`)
    .get('/.well-known/jwks.json')
    .reply(200, {
      keys,
    });
}