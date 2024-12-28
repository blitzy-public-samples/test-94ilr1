import { initTracer as initJaegerTracer, JaegerTracer, TracingConfig } from 'jaeger-client'; // version: ^3.19.0
import { FORMAT_HTTP_HEADERS, Span, SpanContext, Tracer, Tags } from 'opentracing'; // version: ^0.14.7
import { Request, Response, NextFunction } from 'express'; // version: ^4.18.2
import { Logger } from './logger';
import { MetricsManager, recordLatency } from './metrics';

// Global constants
const DEFAULT_SERVICE_NAME = 'email_assistant';
const TRACE_CONTEXT_HEADER = 'uber-trace-id';
const MAX_SPAN_DURATION_MS = 30000;
const TRACE_SAMPLING_RATE = 0.1;

// Configuration interfaces
interface TracerConfig {
  serviceName?: string;
  jaegerEndpoint?: string;
  samplingRate?: number;
  maxSpanDuration?: number;
  tags?: Record<string, string>;
}

interface SpanOptions {
  parent?: Span | SpanContext;
  tags?: Record<string, string | number>;
  startTime?: number;
}

// Initialize Jaeger tracer with security enhancements
export function initializeTracer(config: TracerConfig): Tracer {
  const tracerConfig: TracingConfig = {
    serviceName: config.serviceName || DEFAULT_SERVICE_NAME,
    sampler: {
      type: 'probabilistic',
      param: config.samplingRate || TRACE_SAMPLING_RATE,
    },
    reporter: {
      logSpans: true,
      agentHost: new URL(config.jaegerEndpoint || 'http://localhost:6832').hostname,
      agentPort: parseInt(new URL(config.jaegerEndpoint || 'http://localhost:6832').port),
      // Enhanced security options
      collectorEndpoint: config.jaegerEndpoint,
      username: process.env.JAEGER_AGENT_USER,
      password: process.env.JAEGER_AGENT_PASSWORD,
    },
    // Additional security headers
    headers: {
      'X-Security-Context': process.env.SECURITY_CONTEXT || 'production',
    },
  };

  const tracer = initJaegerTracer(tracerConfig);
  
  if (!tracer) {
    throw new Error('Failed to initialize Jaeger tracer');
  }

  return tracer;
}

// Express middleware for secure trace context propagation
export function createTracingMiddleware(tracer: Tracer) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const spanContext = tracer.extract(FORMAT_HTTP_HEADERS, req.headers);
    
    const span = tracer.startSpan('http_request', {
      childOf: spanContext || undefined,
      tags: {
        [Tags.HTTP_METHOD]: req.method,
        [Tags.HTTP_URL]: req.url,
        [Tags.SPAN_KIND]: Tags.SPAN_KIND_RPC_SERVER,
        'service.name': DEFAULT_SERVICE_NAME,
        'request.id': req.headers['x-request-id'] || '',
      },
    });

    // Secure span context propagation
    const carrier: Record<string, string> = {};
    tracer.inject(span.context(), FORMAT_HTTP_HEADERS, carrier);
    Object.entries(carrier).forEach(([key, value]) => {
      res.setHeader(key, value);
    });

    // Track request timing
    const startTime = Date.now();

    // Cleanup function
    const finishSpan = () => {
      const duration = Date.now() - startTime;
      span.setTag(Tags.HTTP_STATUS_CODE, res.statusCode);
      
      if (res.statusCode >= 400) {
        span.setTag(Tags.ERROR, true);
        span.log({
          event: 'error',
          'status.code': res.statusCode,
        });
      }

      // Record metrics
      recordLatency('http_request_duration', duration, {
        method: req.method,
        path: req.path,
        status: res.statusCode.toString(),
      });

      span.finish();
    };

    // Attach listeners for response completion
    res.on('finish', finishSpan);
    res.on('error', (error: Error) => {
      span.setTag(Tags.ERROR, true);
      span.log({
        event: 'error',
        'error.object': error,
        message: error.message,
        stack: error.stack,
      });
      finishSpan();
    });

    next();
  };
}

// Main tracing management class
export class TracingManager {
  private readonly tracer: Tracer;
  private readonly activeSpans: Map<string, Span>;
  private readonly config: Required<TracerConfig>;
  private readonly metricsManager: MetricsManager;
  private readonly logger: Logger;

  constructor(config: TracerConfig) {
    this.config = {
      serviceName: config.serviceName || DEFAULT_SERVICE_NAME,
      jaegerEndpoint: config.jaegerEndpoint || 'http://localhost:6832',
      samplingRate: config.samplingRate || TRACE_SAMPLING_RATE,
      maxSpanDuration: config.maxSpanDuration || MAX_SPAN_DURATION_MS,
      tags: config.tags || {},
    };

    this.tracer = initializeTracer(this.config);
    this.activeSpans = new Map();
    this.metricsManager = new MetricsManager({
      serviceName: this.config.serviceName,
      prefix: 'tracing',
    });
    this.logger = new Logger({
      service: this.config.serviceName,
    });
  }

  public startSpan(operationName: string, options: SpanOptions = {}): Span {
    const startTime = options.startTime || Date.now();
    
    const span = this.tracer.startSpan(operationName, {
      childOf: options.parent,
      startTime,
      tags: {
        ...this.config.tags,
        ...options.tags,
        'service.name': this.config.serviceName,
      },
    });

    // Set span timeout for safety
    setTimeout(() => {
      if (this.activeSpans.has(span.context().toTraceId())) {
        this.finishSpan(span, { error: 'Span timeout exceeded' });
      }
    }, this.config.maxSpanDuration);

    this.activeSpans.set(span.context().toTraceId(), span);
    return span;
  }

  public finishSpan(span: Span, metadata: Record<string, any> = {}): void {
    const traceId = span.context().toTraceId();
    
    try {
      if (metadata.error) {
        span.setTag(Tags.ERROR, true);
        span.log({
          event: 'error',
          'error.object': metadata.error,
        });
      }

      // Add final metadata
      Object.entries(metadata).forEach(([key, value]) => {
        span.setTag(key, value);
      });

      span.finish();
      this.activeSpans.delete(traceId);

      // Record metrics
      this.metricsManager.incrementCounter('spans_completed', {
        operation: span.operationName,
        status: metadata.error ? 'error' : 'success',
      });
    } catch (error) {
      this.logger.error('Error finishing span', error as Error, {
        traceId,
        operation: span.operationName,
      });
    }
  }

  public injectTraceContext(span: Span, carrier: Record<string, string>): Record<string, string> {
    try {
      this.tracer.inject(span.context(), FORMAT_HTTP_HEADERS, carrier);
      return carrier;
    } catch (error) {
      this.logger.error('Error injecting trace context', error as Error, {
        traceId: span.context().toTraceId(),
      });
      return carrier;
    }
  }

  public extractTraceContext(carrier: Record<string, string>): SpanContext | null {
    try {
      return this.tracer.extract(FORMAT_HTTP_HEADERS, carrier);
    } catch (error) {
      this.logger.error('Error extracting trace context', error as Error);
      return null;
    }
  }
}