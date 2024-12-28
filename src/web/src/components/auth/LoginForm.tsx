import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { styled } from '@mui/material/styles';
import { debounce } from 'lodash';
import TextField from '../common/TextField';
import Button from '../common/Button';
import { AuthCredentials, AuthResponse, MFAMethod } from '../../types/auth.types';
import { useAuth } from '../../hooks/useAuth';
import { validateAuthCredentials, sanitizeInput } from '../../utils/validation.utils';

// Styled components with Material Design 3.0 principles
const FormContainer = styled('form')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(3),
  padding: theme.spacing(4),
  maxWidth: '400px',
  width: '100%',
  margin: '0 auto',
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius * 2,
  boxShadow: theme.shadows[3],
  transition: theme.transitions.create(['box-shadow']),

  '&:focus-within': {
    boxShadow: theme.shadows[8],
  },

  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(3),
    gap: theme.spacing(2),
  },
}));

const ErrorMessage = styled('div')(({ theme }) => ({
  color: theme.palette.error.main,
  fontSize: theme.typography.caption.fontSize,
  padding: theme.spacing(1),
  borderRadius: theme.shape.borderRadius,
  backgroundColor: theme.palette.error.light,
  opacity: 0.9,
  marginBottom: theme.spacing(2),
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  
  '& svg': {
    fontSize: '1.2rem',
  },
}));

// Props interface
interface LoginFormProps {
  onSuccess?: (response: AuthResponse) => void;
  redirectPath?: string;
  maxAttempts?: number;
}

// Main component
const LoginForm: React.FC<LoginFormProps> = ({
  onSuccess,
  redirectPath = '/dashboard',
  maxAttempts = 3,
}) => {
  // State management
  const [credentials, setCredentials] = useState<AuthCredentials>({
    email: '',
    password: '',
    rememberMe: false,
  });
  const [mfaCode, setMfaCode] = useState<string>('');
  const [showMfa, setShowMfa] = useState<boolean>(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [attempts, setAttempts] = useState<number>(0);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const lockTimeoutRef = useRef<NodeJS.Timeout>();

  // Hooks
  const { login, verifyMFA, error, loading } = useAuth();
  const navigate = useNavigate();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (lockTimeoutRef.current) {
        clearTimeout(lockTimeoutRef.current);
      }
    };
  }, []);

  // Debounced validation
  const validateForm = useCallback(
    debounce((credentials: AuthCredentials) => {
      const validation = validateAuthCredentials(credentials);
      setValidationErrors(validation.errors);
      return validation.isValid;
    }, 300),
    []
  );

  // Input handlers
  const handleInputChange = useCallback((field: keyof AuthCredentials, value: string) => {
    const sanitizedValue = sanitizeInput(value);
    setCredentials(prev => ({
      ...prev,
      [field]: sanitizedValue,
    }));
    validateForm({ ...credentials, [field]: sanitizedValue });
  }, [credentials, validateForm]);

  const handleMfaChange = useCallback((value: string) => {
    const sanitizedValue = sanitizeInput(value);
    setMfaCode(sanitizedValue);
  }, []);

  // Form submission handler
  const handleSubmit = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();

    if (isLocked || loading) {
      return;
    }

    try {
      if (!showMfa) {
        const validation = validateAuthCredentials(credentials);
        if (!validation.isValid) {
          setValidationErrors(validation.errors);
          return;
        }

        const response = await login(credentials);
        
        if (response.requiresMFA) {
          setShowMfa(true);
          return;
        }

        onSuccess?.(response);
        navigate(redirectPath);
      } else {
        if (!mfaCode) {
          setValidationErrors(['MFA code is required']);
          return;
        }

        const response = await verifyMFA({
          code: mfaCode,
          challengeId: '', // Set by the auth system
          method: MFAMethod.TOTP,
        });

        onSuccess?.(response);
        navigate(redirectPath);
      }
    } catch (err) {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);

      if (newAttempts >= maxAttempts) {
        setIsLocked(true);
        lockTimeoutRef.current = setTimeout(() => {
          setIsLocked(false);
          setAttempts(0);
        }, 30000); // 30 seconds lockout
      }
    }
  }, [
    credentials,
    mfaCode,
    showMfa,
    isLocked,
    loading,
    attempts,
    maxAttempts,
    login,
    verifyMFA,
    onSuccess,
    navigate,
    redirectPath,
  ]);

  return (
    <FormContainer onSubmit={handleSubmit} noValidate>
      {(validationErrors.length > 0 || error) && (
        <ErrorMessage role="alert">
          {validationErrors[0] || error}
        </ErrorMessage>
      )}

      {!showMfa ? (
        <>
          <TextField
            name="email"
            type="email"
            label="Email Address"
            value={credentials.email}
            onChange={(value) => handleInputChange('email', value)}
            required
            disabled={isLocked || loading}
            error={validationErrors.some(e => e.includes('email'))}
            aria-label="Email Address"
          />

          <TextField
            name="password"
            type="password"
            label="Password"
            value={credentials.password}
            onChange={(value) => handleInputChange('password', value)}
            required
            disabled={isLocked || loading}
            error={validationErrors.some(e => e.includes('password'))}
            aria-label="Password"
          />
        </>
      ) : (
        <TextField
          name="mfaCode"
          type="text"
          label="MFA Code"
          value={mfaCode}
          onChange={handleMfaChange}
          required
          disabled={loading}
          error={validationErrors.some(e => e.includes('MFA'))}
          aria-label="MFA Code"
        />
      )}

      <Button
        type="submit"
        variant="contained"
        color="primary"
        fullWidth
        disabled={isLocked || loading || validationErrors.length > 0}
        loading={loading}
        aria-label={showMfa ? "Verify MFA Code" : "Sign In"}
      >
        {showMfa ? "Verify" : "Sign In"}
      </Button>

      {isLocked && (
        <ErrorMessage role="alert">
          Too many failed attempts. Please try again in 30 seconds.
        </ErrorMessage>
      )}
    </FormContainer>
  );
};

export default React.memo(LoginForm);