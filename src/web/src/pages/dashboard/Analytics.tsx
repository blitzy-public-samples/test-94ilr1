import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Grid, Typography, Box, Skeleton } from '@mui/material'; // v5.14.0
import { BarChart, LineChart, PieChart } from '@mui/x-charts'; // v6.0.0
import { useSelector, useDispatch } from 'react-redux'; // v8.1.0
import { ErrorBoundary, useErrorBoundary } from 'react-error-boundary'; // v4.0.11

// Internal imports
import DashboardLayout from '../../layouts/DashboardLayout';
import Card from '../../components/common/Card';
import { useEmail } from '../../hooks/useEmail';
import { selectEmails } from '../../store/email.slice';

// Constants for analytics
const METRIC_TYPES = {
  RESPONSE_TIME: 'response_time',
  CONTEXT_ACCURACY: 'context_accuracy',
  PRODUCTIVITY_GAIN: 'productivity_gain',
  EMAIL_VOLUME: 'email_volume',
  TIME_SAVED: 'time_saved',
  ERROR_RATE: 'error_rate',
  USER_SATISFACTION: 'user_satisfaction'
} as const;

const CHART_COLORS = {
  primary: '#1976d2',
  success: '#2e7d32',
  warning: '#ed6c02',
  error: '#d32f2f',
  neutral: '#757575'
} as const;

const METRIC_THRESHOLDS = {
  response_time: 120,
  context_accuracy: 95,
  productivity_gain: 600,
  error_rate: 0.5
} as const;

// Interface for analytics metrics
interface IAnalyticsMetric {
  label: string;
  value: number;
  change: number;
  trend: TrendData[];
  status: 'success' | 'warning' | 'error';
  threshold: number;
  description: string;
}

interface TrendData {
  date: Date;
  value: number;
}

// Analytics component with error boundary and accessibility
const Analytics: React.FC = React.memo(() => {
  const { showBoundary } = useErrorBoundary();
  const [metrics, setMetrics] = useState<IAnalyticsMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const emails = useSelector(selectEmails);
  const { fetchEmails } = useEmail();

  // Calculate metrics from email data
  const calculateMetrics = useCallback(() => {
    try {
      const currentDate = new Date();
      const thirtyDaysAgo = new Date(currentDate.setDate(currentDate.getDate() - 30));

      // Response time calculation
      const avgResponseTime = emails.reduce((acc, email) => {
        const responseTime = email.sentAt.getTime() - email.receivedAt.getTime();
        return acc + responseTime;
      }, 0) / emails.length;

      // Context accuracy calculation
      const contextAccuracy = emails.filter(email => 
        email.metadata.contextAccurate
      ).length / emails.length * 100;

      // Productivity gain calculation
      const productivityGain = emails.reduce((acc, email) => 
        acc + (email.metadata.timeSaved || 0), 0);

      return [
        {
          label: 'Average Response Time',
          value: avgResponseTime,
          change: -15,
          trend: generateTrendData(30),
          status: avgResponseTime < METRIC_THRESHOLDS.response_time ? 'success' : 'warning',
          threshold: METRIC_THRESHOLDS.response_time,
          description: 'Average time to respond to emails in minutes'
        },
        {
          label: 'Context Accuracy',
          value: contextAccuracy,
          change: 5,
          trend: generateTrendData(30),
          status: contextAccuracy >= METRIC_THRESHOLDS.context_accuracy ? 'success' : 'warning',
          threshold: METRIC_THRESHOLDS.context_accuracy,
          description: 'Accuracy of context identification in percentage'
        },
        {
          label: 'Productivity Gain',
          value: productivityGain,
          change: 20,
          trend: generateTrendData(30),
          status: productivityGain >= METRIC_THRESHOLDS.productivity_gain ? 'success' : 'warning',
          threshold: METRIC_THRESHOLDS.productivity_gain,
          description: 'Time saved in minutes through automation'
        }
      ];
    } catch (error) {
      showBoundary(error);
      return [];
    }
  }, [emails, showBoundary]);

  // Generate trend data for charts
  const generateTrendData = useCallback((days: number): TrendData[] => {
    const data: TrendData[] = [];
    const today = new Date();
    
    for (let i = days; i > 0; i--) {
      data.push({
        date: new Date(today.setDate(today.getDate() - 1)),
        value: Math.random() * 100
      });
    }
    
    return data;
  }, []);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        await fetchEmails();
        const calculatedMetrics = calculateMetrics();
        setMetrics(calculatedMetrics);
      } catch (error) {
        showBoundary(error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [fetchEmails, calculateMetrics, showBoundary]);

  // Render metric card
  const renderMetricCard = useCallback((metric: IAnalyticsMetric) => (
    <Card
      key={metric.label}
      className={`metric-card status-${metric.status}`}
      ariaLabel={`${metric.label}: ${metric.value}`}
      elevation={2}
    >
      <Box sx={{ p: 2 }}>
        <Typography variant="h6" component="h2" gutterBottom>
          {metric.label}
        </Typography>
        <Typography variant="h4" component="p" color={`${metric.status}.main`}>
          {metric.value.toFixed(1)}
        </Typography>
        <Typography 
          variant="body2" 
          color={metric.change >= 0 ? 'success.main' : 'error.main'}
        >
          {metric.change >= 0 ? '+' : ''}{metric.change}% vs last period
        </Typography>
        <Box sx={{ height: 100, mt: 2 }}>
          <LineChart
            dataset={metric.trend}
            xAxis={[{ dataKey: 'date', scaleType: 'time' }]}
            yAxis={[{ dataKey: 'value' }]}
            series={[{ dataKey: 'value', color: CHART_COLORS[metric.status] }]}
            height={100}
            aria-label={`Trend chart for ${metric.label}`}
          />
        </Box>
      </Box>
    </Card>
  ), []);

  return (
    <DashboardLayout pageTitle="Analytics">
      <Box
        component="section"
        role="region"
        aria-label="Email Analytics Dashboard"
        sx={{ p: { xs: 2, sm: 3 } }}
      >
        <Typography variant="h4" component="h1" gutterBottom>
          Analytics Dashboard
        </Typography>

        <Grid container spacing={3}>
          {loading ? (
            Array.from(new Array(3)).map((_, index) => (
              <Grid item xs={12} md={4} key={index}>
                <Skeleton 
                  variant="rectangular" 
                  height={200} 
                  sx={{ borderRadius: 2 }}
                  aria-label="Loading metric card"
                />
              </Grid>
            ))
          ) : (
            metrics.map((metric) => (
              <Grid item xs={12} md={4} key={metric.label}>
                {renderMetricCard(metric)}
              </Grid>
            ))
          )}
        </Grid>
      </Box>
    </DashboardLayout>
  );
});

Analytics.displayName = 'Analytics';

// Wrap with error boundary for production error handling
const AnalyticsWithErrorBoundary: React.FC = () => (
  <ErrorBoundary
    fallback={
      <Box 
        role="alert" 
        sx={{ p: 3 }}
        aria-label="Error loading analytics"
      >
        <Typography color="error">
          An error occurred while loading the analytics dashboard.
          Please try refreshing the page.
        </Typography>
      </Box>
    }
  >
    <Analytics />
  </ErrorBoundary>
);

export default AnalyticsWithErrorBoundary;