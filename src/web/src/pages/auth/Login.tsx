import React, { useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import AuthLayout from '../../layouts/AuthLayout';
import LoginForm from '../../components/auth/LoginForm';
import { useAuth } from '../../hooks/useAuth';

// Version comments for external dependencies
// react v18.2.0
// react-router-dom v6.14.0
// react-error-boundary v4.0.11

/**
 * Error fallback component for graceful error handling
 */
const ErrorFallback: React.FC<{ error: Error }> = ({ error }) => (
  <AuthLayout>
    <div role="alert">
      <h2>Authentication Error</h2>
      <pre style={{ color: 'red' }}>{error.message}</pre>
      <button onClick={() => window.location.reload()}>Try Again</button>
    </div>
  </AuthLayout>
);

/**
 * LoginPage component implementing secure authentication with OAuth 2.0 and MFA support
 * Follows Material Design 3.0 principles and WCAG 2.1 Level AA compliance
 */
const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, error, loading, validateSession } = useAuth();

  // Get redirect path from location state or default to dashboard
  const redirectPath = useMemo(() => {
    const state = location.state as { from?: string };
    return state?.from || '/dashboard';
  }, [location]);

  /**
   * Validates existing session on component mount
   * Redirects to dashboard if valid session exists
   */
  useEffect(() => {
    const checkSession = async () => {
      const isValid = await validateSession();
      if (isValid) {
        navigate(redirectPath, { replace: true });
      }
    };

    checkSession();
  }, [validateSession, navigate, redirectPath]);

  /**
   * Handles successful authentication with analytics and security logging
   */
  const handleLoginSuccess = useCallback(async (response: any) => {
    // Log successful authentication event
    console.info('Authentication successful', {
      timestamp: new Date().toISOString(),
      requiresMFA: response.requiresMFA
    });

    if (response.requiresMFA) {
      // Navigate to MFA verification page with challenge ID
      navigate('/auth/mfa', {
        state: {
          challengeId: response.mfaChallengeId,
          from: redirectPath
        }
      });
    } else {
      // Navigate to protected route after successful authentication
      navigate(redirectPath, { replace: true });
    }
  }, [navigate, redirectPath]);

  /**
   * Handles authentication errors with comprehensive error tracking
   */
  const handleLoginError = useCallback((error: Error) => {
    // Log authentication error for monitoring
    console.error('Authentication error:', {
      message: error.message,
      timestamp: new Date().toISOString(),
      path: location.pathname
    });
  }, [location]);

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={handleLoginError}
      onReset={() => {
        // Reset error boundary state
        window.location.reload();
      }}
    >
      <AuthLayout
        title="Sign In"
        onAuthSuccess={handleLoginSuccess}
        onAuthError={handleLoginError}
      >
        <LoginForm
          onSuccess={handleLoginSuccess}
          redirectPath={redirectPath}
          maxAttempts={3}
        />

        {/* Accessibility announcement for authentication status */}
        {loading && (
          <div
            role="status"
            aria-live="polite"
            className="sr-only"
          >
            Authenticating, please wait...
          </div>
        )}

        {/* Error message with proper ARIA attributes */}
        {error && (
          <div
            role="alert"
            aria-live="assertive"
            style={{
              color: 'red',
              marginTop: '1rem',
              textAlign: 'center'
            }}
          >
            {error}
          </div>
        )}

        {/* Skip link for keyboard navigation */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only"
          style={{
            position: 'absolute',
            left: '-9999px',
            zIndex: 999
          }}
        >
          Skip to main content
        </a>
      </AuthLayout>
    </ErrorBoundary>
  );
};

export default LoginPage;