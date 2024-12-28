import React from 'react'; // v18.2.0
import ReactDOM from 'react-dom/client'; // v18.2.0
import { Provider } from 'react-redux'; // v8.1.0
import { StrictMode } from 'react'; // v18.2.0
import * as Sentry from '@sentry/react'; // v7.0.0
import { Analytics } from '@segment/analytics-next'; // v1.51.0
import { ErrorBoundary } from '@sentry/react'; // v7.0.0
import { ThemeProvider } from '@mui/material'; // v5.14.0

// Internal imports
import App from './App';
import { store } from './store';
import { lightTheme } from './styles/theme';

// Initialize error monitoring and analytics
const initializeMonitoring = (): void => {
  // Initialize Sentry for error tracking
  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV,
      tracesSampleRate: 1.0,
      integrations: [
        new Sentry.BrowserTracing(),
        new Sentry.Replay({
          maskAllText: true,
          blockAllMedia: true,
        }),
      ],
    });
  }

  // Initialize Segment analytics
  if (process.env.ANALYTICS_KEY) {
    const analytics = new Analytics({
      writeKey: process.env.ANALYTICS_KEY,
      plugins: [
        {
          name: 'Custom Plugin',
          type: 'enrichment',
          version: '1.0.0',
          isLoaded: () => true,
          load: () => Promise.resolve(),
        },
      ],
    });
    window.analytics = analytics;
  }
};

// Initialize app with browser compatibility checks
const initializeApp = (): void => {
  // Check browser compatibility
  const isCompatibleBrowser = (): boolean => {
    const userAgent = window.navigator.userAgent;
    return (
      /Chrome\/9\d/.test(userAgent) ||
      /Firefox\/8\d/.test(userAgent) ||
      /Safari\/1[4-9]/.test(userAgent) ||
      /Edge\/9\d/.test(userAgent)
    );
  };

  if (!isCompatibleBrowser()) {
    console.warn('Browser version not fully supported');
  }

  // Initialize monitoring
  initializeMonitoring();

  // Register service worker for PWA support
  if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js').catch((error) => {
        console.error('ServiceWorker registration failed:', error);
      });
    });
  }
};

// Render app with all required providers
const renderApp = (): void => {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Root element not found');
  }

  const root = ReactDOM.createRoot(rootElement);

  root.render(
    <StrictMode>
      <ErrorBoundary
        fallback={({ error }) => (
          <div role="alert">
            <h1>Application Error</h1>
            <pre>{error.message}</pre>
          </div>
        )}
        showDialog={process.env.NODE_ENV === 'development'}
      >
        <Provider store={store}>
          <ThemeProvider theme={lightTheme}>
            <App />
          </ThemeProvider>
        </Provider>
      </ErrorBoundary>
    </StrictMode>
  );

  // Enable React DevTools in development
  if (process.env.NODE_ENV === 'development') {
    // @ts-ignore
    window.__REACT_DEVTOOLS_GLOBAL_HOOK__.inject = function () {};
  }
};

// Initialize and render application
initializeApp();
renderApp();

// Type definitions for global window object
declare global {
  interface Window {
    analytics: Analytics;
  }
}

// Enable hot module replacement in development
if (import.meta.hot) {
  import.meta.hot.accept();
}