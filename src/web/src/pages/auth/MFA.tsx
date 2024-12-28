import React, { useEffect, useCallback, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import { useAuth } from '../../hooks/useAuth';
import MFAForm from '../../components/auth/MFAForm';
import AuthLayout from '../../layouts/AuthLayout';

// Constants for security configuration
const MAX_ATTEMPTS = 3;
const SESSION_TIMEOUT = 300; // 5 minutes in seconds
const SECURITY_EVENT_TYPES = {
  MFA_SUCCESS: 'MFA_SUCCESS',
  MFA_FAILURE: 'MFA_FAILURE',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  INVALID_CHALLENGE: 'INVALID_CHALLENGE'
} as const;

/**
 * MFA verification page component with comprehensive security features
 * Implements WCAG 2.1 Level AA compliance and security monitoring
 */
const MFAPage: React.FC = () => {
  // Hooks
  const navigate = useNavigate();
  const location = useLocation();
  const { verifyMFA, isAuthenticated, validateSession } = useAuth();

  // State management
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  // Security monitoring
  const securityMonitorRef = useRef({
    attempts: 0,
    lastAttempt: Date.now(),
    challengeVerified: false
  });

  // Session management
  const sessionTimeoutRef = useRef<NodeJS.Timeout>();

  /**
   * Validates the MFA challenge from location state
   */
  const validateChallenge = useCallback(() => {
    const state = location.state as { challengeId?: string } | undefined;
    
    if (!state?.challengeId) {
      setError('Invalid authentication challenge');
      navigate('/login', { replace: true });
      return null;
    }

    return state.challengeId;
  }, [location.state, navigate]);

  /**
   * Handles successful MFA verification
   */
  const handleSuccess = useCallback(() => {
    securityMonitorRef.current.challengeVerified = true;
    securityMonitorRef.current.attempts = 0;

    // Clear any existing timeouts
    if (sessionTimeoutRef.current) {
      clearTimeout(sessionTimeoutRef.current);
    }

    navigate('/dashboard', { replace: true });
  }, [navigate]);

  /**
   * Handles MFA verification errors with rate limiting
   */
  const handleError = useCallback((errorMessage: string) => {
    const monitor = securityMonitorRef.current;
    monitor.attempts += 1;
    monitor.lastAttempt = Date.now();

    if (monitor.attempts >= MAX_ATTEMPTS) {
      setError('Maximum verification attempts exceeded. Please try again later.');
      navigate('/login', { replace: true });
      return;
    }

    setError(errorMessage);
  }, [navigate]);

  /**
   * Validates session state and authentication
   */
  useEffect(() => {
    const validateAuthState = async () => {
      try {
        const isSessionValid = await validateSession();
        
        if (!isSessionValid || isAuthenticated) {
          navigate('/login', { replace: true });
          return;
        }

        // Set session timeout
        sessionTimeoutRef.current = setTimeout(() => {
          setError('Session expired. Please login again.');
          navigate('/login', { replace: true });
        }, SESSION_TIMEOUT * 1000);
      } catch (error) {
        navigate('/login', { replace: true });
      }
    };

    validateAuthState();

    return () => {
      if (sessionTimeoutRef.current) {
        clearTimeout(sessionTimeoutRef.current);
      }
    };
  }, [isAuthenticated, validateSession, navigate]);

  /**
   * Error boundary fallback component
   */
  const ErrorFallback = useCallback(({ error, resetErrorBoundary }: any) => {
    useEffect(() => {
      // Log error for monitoring
      console.error('MFA Error:', error);
      
      // Auto-reset after 5 seconds
      const resetTimer = setTimeout(resetErrorBoundary, 5000);
      return () => clearTimeout(resetTimer);
    }, [error, resetErrorBoundary]);

    return (
      <AuthLayout
        title="Verification Error"
        onAuthSuccess={() => {}}
        onAuthError={() => {}}
      >
        <div role="alert">
          An error occurred during verification. Redirecting...
        </div>
      </AuthLayout>
    );
  }, []);

  // Get and validate challenge ID
  const challengeId = validateChallenge();
  if (!challengeId) return null;

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => {
        setError('');
        setLoading(false);
      }}
    >
      <AuthLayout
        title="Two-Factor Authentication"
        onAuthSuccess={handleSuccess}
        onAuthError={({ message }) => handleError(message)}
      >
        <MFAForm
          challengeId={challengeId}
          onSuccess={handleSuccess}
          onError={handleError}
          maxAttempts={MAX_ATTEMPTS}
          sessionTimeout={SESSION_TIMEOUT}
        />
      </AuthLayout>
    </ErrorBoundary>
  );
};

export default MFAPage;