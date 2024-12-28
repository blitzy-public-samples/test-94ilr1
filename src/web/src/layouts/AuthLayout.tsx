import React, { useState, useEffect, useCallback } from 'react';
import { Box, Container, Paper, Typography, useTheme } from '@mui/material';
import { styled } from '@mui/material/styles';
import LoginForm, { LoginFormProps } from '../components/auth/LoginForm';
import MFAForm from '../components/auth/MFAForm';
import Loading from '../components/common/Loading';

// Version comments for dependencies
// @mui/material v5.14.0
// react v18.2.0

// Styled components with Material Design 3.0 principles
const AuthContainer = styled(Container)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  minHeight: '100vh',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: theme.palette.background.default,
  padding: theme.spacing(3),
  transition: theme.transitions.create(['background-color'], {
    duration: theme.transitions.duration.standard,
  }),
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(2),
  },
}));

const AuthPaper = styled(Paper)(({ theme }) => ({
  maxWidth: 400,
  width: '100%',
  padding: theme.spacing(4),
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  borderRadius: theme.shape.borderRadius * 2,
  boxShadow: theme.shadows[8],
  backgroundColor: theme.palette.background.paper,
  position: 'relative',
  overflow: 'hidden',
  transition: theme.transitions.create(['box-shadow', 'transform'], {
    duration: theme.transitions.duration.short,
  }),
  '&:focus-within': {
    boxShadow: theme.shadows[12],
  },
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(3),
    borderRadius: theme.shape.borderRadius,
  },
}));

const AuthTitle = styled(Typography)(({ theme }) => ({
  marginBottom: theme.spacing(4),
  color: theme.palette.text.primary,
  textAlign: 'center',
  fontWeight: theme.typography.fontWeightBold,
  [theme.breakpoints.down('sm')]: {
    marginBottom: theme.spacing(3),
    fontSize: '1.5rem',
  },
}));

// Interface for authentication errors
interface AuthError {
  code: string;
  message: string;
  details: Record<string, any>;
}

// Props interface with enhanced security and accessibility features
interface AuthLayoutProps {
  children?: React.ReactNode;
  title?: string;
  onAuthSuccess: (token: string) => void;
  onAuthError: (error: AuthError) => void;
}

/**
 * AuthLayout component providing secure authentication page structure
 * Implements Material Design 3.0 and WCAG 2.1 Level AA compliance
 */
const AuthLayout: React.FC<AuthLayoutProps> = ({
  children,
  title = 'Sign In',
  onAuthSuccess,
  onAuthError,
}) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [showMfa, setShowMfa] = useState(false);
  const [challengeId, setChallengeId] = useState<string>('');

  // Security monitoring state
  const [securityContext, setSecurityContext] = useState({
    lastAttempt: 0,
    attempts: 0,
    locked: false,
  });

  // Reset security context after lockout period
  useEffect(() => {
    if (securityContext.locked) {
      const unlockTimeout = setTimeout(() => {
        setSecurityContext(prev => ({
          ...prev,
          locked: false,
          attempts: 0,
        }));
      }, 300000); // 5 minutes lockout

      return () => clearTimeout(unlockTimeout);
    }
  }, [securityContext.locked]);

  /**
   * Handles successful login with security validation
   */
  const handleLoginSuccess = useCallback(async (response: any) => {
    try {
      setLoading(true);

      if (response.requiresMFA) {
        setShowMfa(true);
        setChallengeId(response.mfaChallengeId);
      } else {
        onAuthSuccess(response.tokens.accessToken);
      }

      // Reset security context on success
      setSecurityContext({
        lastAttempt: Date.now(),
        attempts: 0,
        locked: false,
      });
    } catch (error) {
      onAuthError(error as AuthError);
    } finally {
      setLoading(false);
    }
  }, [onAuthSuccess, onAuthError]);

  /**
   * Handles authentication errors with rate limiting
   */
  const handleAuthError = useCallback((error: AuthError) => {
    setSecurityContext(prev => {
      const newAttempts = prev.attempts + 1;
      const locked = newAttempts >= 3;

      if (locked) {
        onAuthError({
          code: 'AUTH_LOCKED',
          message: 'Too many failed attempts. Please try again later.',
          details: { lockoutDuration: '5 minutes' },
        });
      } else {
        onAuthError(error);
      }

      return {
        lastAttempt: Date.now(),
        attempts: newAttempts,
        locked,
      };
    });
  }, [onAuthError]);

  /**
   * Handles successful MFA verification
   */
  const handleMfaSuccess = useCallback(() => {
    setShowMfa(false);
    setLoading(false);
    onAuthSuccess('mfa-verified');
  }, [onAuthSuccess]);

  return (
    <AuthContainer maxWidth="sm">
      <AuthPaper
        elevation={8}
        role="main"
        aria-label="Authentication form"
      >
        <AuthTitle variant="h4" component="h1">
          {title}
        </AuthTitle>

        {loading && (
          <Loading
            size={40}
            overlay
            ariaLabel="Authenticating"
          />
        )}

        {!loading && !showMfa && (
          <LoginForm
            onSuccess={handleLoginSuccess}
            onError={handleAuthError}
            disabled={securityContext.locked}
          />
        )}

        {!loading && showMfa && (
          <MFAForm
            challengeId={challengeId}
            onSuccess={handleMfaSuccess}
            onError={handleAuthError}
            maxAttempts={3}
            sessionTimeout={300}
          />
        )}

        {children}
      </AuthPaper>
    </AuthContainer>
  );
};

export default AuthLayout;