import { describe, test, expect, beforeAll, afterAll, jest } from '@jest/globals'; // version: ^29.7.0
import supertest from 'supertest'; // version: ^6.3.3
import nock from 'nock'; // version: ^13.3.8
import Redis from 'ioredis-mock'; // version: ^8.9.0
import { Registry } from 'prom-client'; // version: ^14.2.0
import { ApiGateway } from '../../src/main';
import { AuthMiddleware } from '../../src/middleware/auth.middleware';
import { RateLimiter } from '../../src/middleware/rate-limit.middleware';

// Test configuration constants
const TEST_PORT = 4000;
const TEST_HOST = 'localhost';
const VALID_TEST_TOKEN = 'valid-test-jwt-token';
const REDIS_TEST_HOST = 'localhost';
const REDIS_TEST_PORT = 6379;
const CIRCUIT_BREAKER_THRESHOLD = 5;
const RATE_LIMIT_WINDOW = 60000;
const BURST_LIMIT_THRESHOLD = 10;

describe('API Gateway Integration Tests', () => {
  let app: Express.Application;
  let request: supertest.SuperTest<supertest.Test>;
  let redisClient: Redis;
  let apiGateway: ApiGateway;
  let metricsRegistry: Registry;

  beforeAll(async () => {
    // Initialize mock Redis client
    redisClient = new Redis({
      host: REDIS_TEST_HOST,
      port: REDIS_TEST_PORT,
      lazyConnect: true
    });

    // Mock environment variables
    process.env.PORT = TEST_PORT.toString();
    process.env.HOST = TEST_HOST;
    process.env.NODE_ENV = 'test';
    process.env.AUTH0_DOMAIN = 'test.auth0.com';
    process.env.AUTH0_CLIENT_ID = 'test-client-id';
    process.env.AUTH0_CLIENT_SECRET = 'test-client-secret';

    // Initialize API Gateway
    apiGateway = new ApiGateway();
    await apiGateway.initialize();
    app = apiGateway['app'];
    request = supertest(app);
    metricsRegistry = new Registry();
  });

  afterAll(async () => {
    // Cleanup resources
    await redisClient.quit();
    await apiGateway['server']?.close();
    nock.cleanAll();
    jest.clearAllMocks();
  });

  describe('Authentication Tests', () => {
    test('should authenticate valid JWT token and cache it', async () => {
      // Setup token in Redis cache
      await redisClient.set(`token:${VALID_TEST_TOKEN}`, JSON.stringify({
        decoded: {
          sub: 'test-user',
          permissions: ['read:emails'],
          roles: ['user']
        },
        timestamp: Date.now()
      }));

      const response = await request
        .get('/api/v1/emails')
        .set('Authorization', `Bearer ${VALID_TEST_TOKEN}`)
        .expect(200);

      expect(response.headers['x-correlation-id']).toBeDefined();
      expect(response.headers['strict-transport-security']).toBeDefined();
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });

    test('should reject invalid tokens', async () => {
      const response = await request
        .get('/api/v1/emails')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.error).toBe('Authentication failed');
    });

    test('should handle token blacklisting', async () => {
      // Blacklist a token
      await redisClient.set('blacklist:blacklisted-token', '1', 'EX', 3600);

      const response = await request
        .get('/api/v1/emails')
        .set('Authorization', 'Bearer blacklisted-token')
        .expect(401);

      expect(response.body.error).toBe('Authentication failed');
    });
  });

  describe('Rate Limiting Tests', () => {
    test('should enforce rate limits with Redis', async () => {
      const endpoint = '/api/v1/emails';
      const requests = Array(101).fill(null); // Exceed 100/min limit

      // Send requests in parallel
      const responses = await Promise.all(
        requests.map(() => 
          request
            .get(endpoint)
            .set('Authorization', `Bearer ${VALID_TEST_TOKEN}`)
        )
      );

      // Verify rate limit headers and 429 response
      const lastResponse = responses[responses.length - 1];
      expect(lastResponse.status).toBe(429);
      expect(lastResponse.headers['retry-after']).toBeDefined();
      expect(lastResponse.headers['ratelimit-remaining']).toBe('0');
    });

    test('should handle burst control', async () => {
      const endpoint = '/api/v1/emails';
      
      // Send burst of requests
      const burstResponses = await Promise.all(
        Array(BURST_LIMIT_THRESHOLD + 1).fill(null).map(() =>
          request
            .get(endpoint)
            .set('Authorization', `Bearer ${VALID_TEST_TOKEN}`)
            .send()
        )
      );

      const lastBurstResponse = burstResponses[burstResponses.length - 1];
      expect(lastBurstResponse.status).toBe(429);
    });
  });

  describe('Circuit Breaker Tests', () => {
    test('should trigger circuit breaker after failures', async () => {
      const endpoint = '/api/v1/context';
      
      // Mock downstream service failures
      nock('http://context-service:8001')
        .get('/health')
        .times(CIRCUIT_BREAKER_THRESHOLD)
        .reply(500);

      // Send requests to trigger circuit breaker
      for (let i = 0; i < CIRCUIT_BREAKER_THRESHOLD; i++) {
        await request
          .get(endpoint)
          .set('Authorization', `Bearer ${VALID_TEST_TOKEN}`);
      }

      // Verify circuit breaker triggered
      const response = await request
        .get(endpoint)
        .set('Authorization', `Bearer ${VALID_TEST_TOKEN}`)
        .expect(503);

      expect(response.body.error).toBe('Service Unavailable');
    });

    test('should reset circuit breaker after cooling period', async () => {
      const endpoint = '/api/v1/context';

      // Mock service recovery
      nock('http://context-service:8001')
        .get('/health')
        .reply(200);

      // Wait for cooling period
      await new Promise(resolve => setTimeout(resolve, 5000));

      const response = await request
        .get(endpoint)
        .set('Authorization', `Bearer ${VALID_TEST_TOKEN}`)
        .expect(200);

      expect(response.status).toBe(200);
    });
  });

  describe('Metrics and Monitoring Tests', () => {
    test('should expose metrics endpoint', async () => {
      const response = await request
        .get('/metrics')
        .expect(200);

      expect(response.headers['content-type']).toMatch(/^text\/plain/);
      expect(response.text).toContain('api_gateway_');
    });

    test('should track authentication metrics', async () => {
      await request
        .get('/api/v1/emails')
        .set('Authorization', `Bearer ${VALID_TEST_TOKEN}`);

      const metrics = await request.get('/metrics');
      expect(metrics.text).toContain('api_gateway_auth_success_total');
    });

    test('should track rate limit metrics', async () => {
      await request
        .get('/api/v1/emails')
        .set('Authorization', `Bearer ${VALID_TEST_TOKEN}`);

      const metrics = await request.get('/metrics');
      expect(metrics.text).toContain('rate_limit_remaining');
    });
  });

  describe('Error Handling Tests', () => {
    test('should handle upstream service errors gracefully', async () => {
      nock('http://email-service:8000')
        .get('/api/v1/emails')
        .reply(500, { error: 'Internal Server Error' });

      const response = await request
        .get('/api/v1/emails')
        .set('Authorization', `Bearer ${VALID_TEST_TOKEN}`)
        .expect(500);

      expect(response.body.error).toBe('Internal Server Error');
      expect(response.headers['x-correlation-id']).toBeDefined();
    });

    test('should handle timeout errors', async () => {
      nock('http://email-service:8000')
        .get('/api/v1/emails')
        .delay(3000) // Delay longer than timeout
        .reply(200);

      const response = await request
        .get('/api/v1/emails')
        .set('Authorization', `Bearer ${VALID_TEST_TOKEN}`)
        .expect(504);

      expect(response.body.error).toBe('Gateway Timeout');
    });
  });
});