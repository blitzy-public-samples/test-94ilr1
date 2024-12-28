import { Registry, Counter, Gauge, Histogram, Summary, register } from 'prom-client'; // version: ^14.2.0
import { Request, Response, NextFunction } from 'express'; // version: ^4.18.2
import { error as logError, info as logInfo } from './logger';

// Global constants for metrics configuration
const DEFAULT_METRICS_PREFIX = 'email_assistant';

const METRIC_TYPES = {
  COUNTER: 'counter',
  GAUGE: 'gauge',
  HISTOGRAM: 'histogram',
  SUMMARY: 'summary',
} as const;

const METRIC_DEFAULTS = {
  BUFFER_SIZE: 1000,
  CLEANUP_INTERVAL: 300000, // 5 minutes
  COLLECTION_INTERVAL: 10000, // 10 seconds
} as const;

// Types for metric configuration and management
interface MetricsConfig {
  prefix?: string;
  serviceName: string;
  defaultLabels?: Record<string, string>;
  bufferSize?: number;
  cleanupInterval?: number;
  collectionInterval?: number;
}

interface MetricDefinition {
  name: string;
  help: string;
  type: keyof typeof METRIC_TYPES;
  labelNames?: string[];
  buckets?: number[];
  maxAgeSeconds?: number;
}

// MetricsManager class for centralized metrics management
export class MetricsManager {
  private readonly registry: Registry;
  private readonly metrics: Map<string, Counter | Gauge | Histogram | Summary>;
  private readonly config: Required<MetricsConfig>;
  private readonly metricBuffer: Map<string, { value: number; labels: Record<string, string>; timestamp: number }[]>;
  private readonly aggregationHandlers: Map<string, NodeJS.Timeout>;

  constructor(config: MetricsConfig) {
    this.config = {
      prefix: config.prefix || DEFAULT_METRICS_PREFIX,
      serviceName: config.serviceName,
      defaultLabels: { service: config.serviceName, ...config.defaultLabels },
      bufferSize: config.bufferSize || METRIC_DEFAULTS.BUFFER_SIZE,
      cleanupInterval: config.cleanupInterval || METRIC_DEFAULTS.CLEANUP_INTERVAL,
      collectionInterval: config.collectionInterval || METRIC_DEFAULTS.COLLECTION_INTERVAL,
    };

    this.registry = new Registry();
    this.metrics = new Map();
    this.metricBuffer = new Map();
    this.aggregationHandlers = new Map();

    this.initializeDefaultMetrics();
    this.setupCleanupJob();
  }

  private initializeDefaultMetrics(): void {
    // System metrics
    this.createMetric({
      name: 'system_memory_usage',
      help: 'System memory usage in bytes',
      type: METRIC_TYPES.GAUGE,
    });

    // Email processing metrics
    this.createMetric({
      name: 'email_processing_duration',
      help: 'Email processing duration in milliseconds',
      type: METRIC_TYPES.HISTOGRAM,
      buckets: [50, 100, 200, 500, 1000, 2000, 5000],
    });

    // Operation metrics
    this.createMetric({
      name: 'operation_errors_total',
      help: 'Total number of operation errors',
      type: METRIC_TYPES.COUNTER,
      labelNames: ['operation', 'error_type'],
    });
  }

  private setupCleanupJob(): void {
    setInterval(() => {
      const now = Date.now();
      this.metricBuffer.forEach((buffer, metricName) => {
        const validMetrics = buffer.filter(
          (entry) => now - entry.timestamp < this.config.cleanupInterval
        );
        if (validMetrics.length !== buffer.length) {
          this.metricBuffer.set(metricName, validMetrics);
        }
      });
    }, this.config.cleanupInterval);
  }

  private createMetric(definition: MetricDefinition): void {
    const fullName = `${this.config.prefix}_${definition.name}`;
    
    if (this.metrics.has(fullName)) {
      return;
    }

    let metric: Counter | Gauge | Histogram | Summary;

    switch (definition.type) {
      case METRIC_TYPES.COUNTER:
        metric = new Counter({
          name: fullName,
          help: definition.help,
          labelNames: definition.labelNames,
          registers: [this.registry],
        });
        break;

      case METRIC_TYPES.GAUGE:
        metric = new Gauge({
          name: fullName,
          help: definition.help,
          labelNames: definition.labelNames,
          registers: [this.registry],
        });
        break;

      case METRIC_TYPES.HISTOGRAM:
        metric = new Histogram({
          name: fullName,
          help: definition.help,
          labelNames: definition.labelNames,
          buckets: definition.buckets,
          registers: [this.registry],
        });
        break;

      case METRIC_TYPES.SUMMARY:
        metric = new Summary({
          name: fullName,
          help: definition.help,
          labelNames: definition.labelNames,
          maxAgeSeconds: definition.maxAgeSeconds || 600,
          registers: [this.registry],
        });
        break;
    }

    this.metrics.set(fullName, metric);
  }

  public incrementCounter(name: string, labels: Record<string, string> = {}): void {
    const fullName = `${this.config.prefix}_${name}`;
    const metric = this.metrics.get(fullName) as Counter;

    if (!metric) {
      logError(`Metric ${fullName} not found`, new Error('Metric not found'));
      return;
    }

    try {
      metric.inc({ ...this.config.defaultLabels, ...labels });
    } catch (error) {
      logError(`Error incrementing counter ${fullName}`, error as Error);
    }
  }

  public setGauge(name: string, value: number, labels: Record<string, string> = {}): void {
    const fullName = `${this.config.prefix}_${name}`;
    const metric = this.metrics.get(fullName) as Gauge;

    if (!metric) {
      logError(`Metric ${fullName} not found`, new Error('Metric not found'));
      return;
    }

    try {
      metric.set({ ...this.config.defaultLabels, ...labels }, value);
    } catch (error) {
      logError(`Error setting gauge ${fullName}`, error as Error);
    }
  }

  public recordHistogram(name: string, value: number, labels: Record<string, string> = {}): void {
    const fullName = `${this.config.prefix}_${name}`;
    const metric = this.metrics.get(fullName) as Histogram;

    if (!metric) {
      logError(`Metric ${fullName} not found`, new Error('Metric not found'));
      return;
    }

    try {
      metric.observe({ ...this.config.defaultLabels, ...labels }, value);
    } catch (error) {
      logError(`Error recording histogram ${fullName}`, error as Error);
    }
  }

  public async getMetrics(): Promise<string> {
    try {
      return await this.registry.metrics();
    } catch (error) {
      logError('Error getting metrics', error as Error);
      return '';
    }
  }
}

// Initialize metrics with default configuration
export function initializeMetrics(config: MetricsConfig): Registry {
  try {
    const metricsManager = new MetricsManager(config);
    logInfo('Metrics initialized successfully', { service: config.serviceName });
    return metricsManager['registry'];
  } catch (error) {
    logError('Error initializing metrics', error as Error);
    throw error;
  }
}

// Create Express middleware for metrics endpoint
export function createMetricsMiddleware() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const metrics = await register.metrics();
      res.set('Content-Type', register.contentType);
      res.end(metrics);
    } catch (error) {
      next(error);
    }
  };
}

// Helper function for recording operation latencies
export function recordLatency(
  operationName: string,
  duration: number,
  labels: Record<string, string> = {}
): void {
  try {
    const metric = register.getSingleMetric(`${DEFAULT_METRICS_PREFIX}_${operationName}_duration`);
    if (metric && metric instanceof Histogram) {
      metric.observe(labels, duration);
    }
  } catch (error) {
    logError(`Error recording latency for ${operationName}`, error as Error);
  }
}