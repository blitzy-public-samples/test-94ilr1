import { Logger } from '../../shared/utils/logger';
import { MetricsManager } from '../../shared/utils/metrics';
import * as dotenv from 'dotenv'; // version: ^16.3.1
import * as Joi from 'joi'; // version: ^17.11.0

// Load environment variables
dotenv.config();

// Global constants
const GATEWAY_PORT = process.env.GATEWAY_PORT || 3000;
const GATEWAY_HOST = process.env.GATEWAY_HOST || '0.0.0.0';
const MAX_REQUEST_SIZE = process.env.MAX_REQUEST_SIZE || '10mb';
const CIRCUIT_BREAKER_THRESHOLD = process.env.CIRCUIT_BREAKER_THRESHOLD || 50;

// Initialize logger and metrics
const logger = new Logger({
  service: 'api-gateway',
  environment: process.env.NODE_ENV || 'development'
});

const metricsManager = new MetricsManager({
  serviceName: 'api-gateway',
  prefix: 'kong_gateway'
});

// Configuration schema validation
const configSchema = Joi.object({
  services: Joi.object().required(),
  routes: Joi.object().required(),
  plugins: Joi.object().required(),
  upstreams: Joi.object().required(),
  certificates: Joi.object().optional()
});

export class KongConfig {
  private readonly services: any;
  private readonly routes: any;
  private readonly plugins: any;
  private readonly upstreams: any;
  private readonly certificates: any;

  constructor(config: any) {
    this.services = this.configureServices(config.services);
    this.routes = this.configureRoutes(config.routes);
    this.plugins = this.configurePlugins(config.plugins);
    this.upstreams = this.configureUpstreams(config.upstreams);
    this.certificates = config.certificates;
  }

  private configureServices(services: any) {
    return {
      'email-service': {
        url: process.env.EMAIL_SERVICE_URL || 'http://email-service:8000',
        connect_timeout: 60000,
        write_timeout: 60000,
        read_timeout: 60000,
        retries: 5,
        healthchecks: {
          active: {
            healthy: { interval: 5, successes: 2 },
            unhealthy: { interval: 5, http_failures: 2 }
          }
        }
      },
      'context-service': {
        url: process.env.CONTEXT_SERVICE_URL || 'http://context-service:8001',
        connect_timeout: 30000,
        write_timeout: 30000,
        read_timeout: 30000,
        retries: 3,
        healthchecks: {
          active: {
            healthy: { interval: 5, successes: 2 },
            unhealthy: { interval: 5, http_failures: 2 }
          }
        }
      },
      'response-service': {
        url: process.env.RESPONSE_SERVICE_URL || 'http://response-service:8002',
        connect_timeout: 30000,
        write_timeout: 30000,
        read_timeout: 30000,
        retries: 3,
        healthchecks: {
          active: {
            healthy: { interval: 5, successes: 2 },
            unhealthy: { interval: 5, http_failures: 2 }
          }
        }
      }
    };
  }

  private configureRoutes(routes: any) {
    return {
      'email-operations': {
        service: 'email-service',
        paths: ['/api/v1/emails'],
        strip_path: false,
        preserve_host: true,
        protocols: ['https'],
        methods: ['GET', 'POST', 'PUT', 'DELETE']
      },
      'context-queries': {
        service: 'context-service',
        paths: ['/api/v1/context'],
        strip_path: false,
        preserve_host: true,
        protocols: ['https'],
        methods: ['GET', 'POST']
      },
      'response-management': {
        service: 'response-service',
        paths: ['/api/v1/responses'],
        strip_path: false,
        preserve_host: true,
        protocols: ['https'],
        methods: ['GET', 'POST', 'PUT']
      }
    };
  }

  private configurePlugins(plugins: any) {
    return {
      rate_limiting: {
        'email-operations': {
          second: null,
          minute: 100,
          hour: 5000,
          policy: 'local',
          fault_tolerant: true,
          hide_client_headers: false,
          redis_timeout: 2000
        },
        'context-queries': {
          second: null,
          minute: 200,
          hour: 10000,
          policy: 'local',
          fault_tolerant: true,
          hide_client_headers: false,
          redis_timeout: 2000
        },
        'response-management': {
          second: null,
          minute: 50,
          hour: 2500,
          policy: 'local',
          fault_tolerant: true,
          hide_client_headers: false,
          redis_timeout: 2000
        }
      },
      cors: {
        origins: ['*'],
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        headers: ['Accept', 'Authorization', 'Content-Type', 'X-Correlation-ID'],
        exposed_headers: ['X-Rate-Limit-Remaining', 'X-Rate-Limit-Reset'],
        credentials: true,
        max_age: 3600
      },
      jwt: {
        uri_param_names: ['jwt'],
        cookie_names: [],
        key_claim_name: 'kid',
        secret_is_base64: false,
        claims_to_verify: ['exp', 'nbf']
      },
      request_transformer: {
        add: {
          headers: ['X-Correlation-ID:$(uuid)']
        }
      },
      response_transformer: {
        add: {
          headers: ['X-Kong-Upstream-Latency:${latency}']
        }
      },
      ip_restriction: {
        allow: process.env.ALLOWED_IPS?.split(',') || []
      },
      bot_detection: {
        allow: [],
        deny: ['*']
      },
      request_size_limiting: {
        allowed_payload_size: MAX_REQUEST_SIZE
      },
      circuit_breaker: {
        threshold: CIRCUIT_BREAKER_THRESHOLD,
        window_size: 60,
        volume_threshold: 10
      }
    };
  }

  private configureUpstreams(upstreams: any) {
    return {
      'email-service': {
        targets: [
          { target: 'email-service:8000', weight: 100 }
        ],
        healthchecks: {
          active: {
            type: 'http',
            http_path: '/health',
            healthy: { interval: 5, successes: 2 },
            unhealthy: { interval: 5, http_failures: 2 }
          },
          passive: {
            healthy: { successes: 5 },
            unhealthy: { http_failures: 5 }
          }
        }
      }
    };
  }

  public configureRateLimiting(limits: any) {
    logger.info('Configuring rate limiting', { limits });
    this.plugins.rate_limiting = {
      ...this.plugins.rate_limiting,
      ...limits
    };
  }

  public configureSecurityPlugins(securityConfig: any) {
    logger.info('Configuring security plugins', { securityConfig });
    Object.assign(this.plugins, securityConfig);
  }

  public getConfig() {
    return {
      services: this.services,
      routes: this.routes,
      plugins: this.plugins,
      upstreams: this.upstreams,
      certificates: this.certificates
    };
  }
}

export function loadKongConfig(configOverrides: any = {}) {
  try {
    logger.info('Loading Kong configuration');
    
    const config = new KongConfig(configOverrides);
    
    // Validate configuration
    const { error } = configSchema.validate(config.getConfig());
    if (error) {
      throw new Error(`Configuration validation failed: ${error.message}`);
    }

    // Record metrics
    metricsManager.incrementCounter('config_load_success');
    
    logger.info('Kong configuration loaded successfully');
    return config.getConfig();
  } catch (error) {
    logger.error('Failed to load Kong configuration', error as Error);
    metricsManager.incrementCounter('config_load_failure');
    throw error;
  }
}