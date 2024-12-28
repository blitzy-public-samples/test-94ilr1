import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Typography, CircularProgress, Alert } from '@mui/material'; // v5.14.0
import { debounce } from 'lodash'; // v4.17.21
import { MFARequest } from '../../types/auth.types';
import { useAuth } from '../../hooks/useAuth';
import TextField from '../common/TextField';
import Button from '../common/Button';

// Constants for MFA validation
const MFA_CODE_LENGTH = 6;
const MFA_CODE_REGEX = /^[0-9]{6}$/;
const DEBOUNCE_DELAY = 300;
const MAX_ATTEMPTS_BEFORE_LOCKOUT = 3;
const LOCKOUT_DURATION = 300000; // 5 minutes in milliseconds

interface MFAFormProps {
  challengeId: string;
  onSuccess: () => void;
  onError: (error: string) => void;
  maxAttempts?: number;
  sessionTimeout?: number;
}

/**
 * MFAForm component for secure Multi-Factor Authentication verification
 * Implements WCAG 2.1 Level AA compliance and enhanced security measures
 */
const MFAForm: React.FC<MFAFormProps> = ({
  challengeId,
  onSuccess,
  onError,
  maxAttempts = MAX_ATTEMPTS_BEFORE_LOCKOUT,
  sessionTimeout = 300 // 5 minutes
}) => {
  // State management
  const [mfaCode, setMfaCode] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [attempts, setAttempts] = useState<number>(0);
  const [lockoutEndTime, setLockoutEndTime] = useState<number | null>(null);
  const [validationError, setValidationError] = useState<string>('');
  const [isSessionValid, setIsSessionValid] = useState<boolean>(true);

  // Refs
  const formRef = useRef<HTMLFormElement>(null);
  const sessionTimeoutRef = useRef<NodeJS.Timeout>();

  // Custom hooks
  const { verifyMFA } = useAuth();

  /**
   * Validates MFA code format and security requirements
   */
  const validateMFACode = useCallback((code: string): boolean => {
    if (!code) {
      setValidationError('Please enter your verification code');
      return false;
    }

    if (!MFA_CODE_REGEX.test(code)) {
      setValidationError('Code must be 6 digits');
      return false;
    }

    // Check for sequential or repeated numbers
    if (/(\d)\1{5}/.test(code) || /012345|123456|987654/.test(code)) {
      setValidationError('Invalid code format');
      return false;
    }

    setValidationError('');
    return true;
  }, []);

  /**
   * Debounced code validation to prevent excessive validation calls
   */
  const debouncedValidation = useCallback(
    debounce((code: string) => validateMFACode(code), DEBOUNCE_DELAY),
    [validateMFACode]
  );

  /**
   * Handles MFA code input changes with validation
   */
  const handleCodeChange = useCallback((value: string) => {
    const sanitizedValue = value.replace(/[^0-9]/g, '').slice(0, MFA_CODE_LENGTH);
    setMfaCode(sanitizedValue);
    debouncedValidation(sanitizedValue);
  }, [debouncedValidation]);

  /**
   * Handles form submission with security checks
   */
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!isSessionValid) {
      onError('Session expired. Please refresh and try again.');
      return;
    }

    if (lockoutEndTime && Date.now() < lockoutEndTime) {
      const remainingTime = Math.ceil((lockoutEndTime - Date.now()) / 1000);
      onError(`Too many attempts. Please try again in ${remainingTime} seconds.`);
      return;
    }

    if (!validateMFACode(mfaCode)) {
      return;
    }

    try {
      setIsSubmitting(true);

      const mfaRequest: MFARequest = {
        code: mfaCode,
        challengeId,
        method: 'TOTP'
      };

      await verifyMFA(mfaRequest);
      onSuccess();
    } catch (error) {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);

      if (newAttempts >= maxAttempts) {
        const lockoutEnd = Date.now() + LOCKOUT_DURATION;
        setLockoutEndTime(lockoutEnd);
        onError(`Maximum attempts exceeded. Please try again in 5 minutes.`);
      } else {
        onError(`Invalid code. ${maxAttempts - newAttempts} attempts remaining.`);
      }
    } finally {
      setIsSubmitting(false);
      setMfaCode('');
      formRef.current?.reset();
    }
  };

  /**
   * Sets up session timeout monitoring
   */
  useEffect(() => {
    sessionTimeoutRef.current = setTimeout(() => {
      setIsSessionValid(false);
      onError('Session expired. Please refresh and try again.');
    }, sessionTimeout * 1000);

    return () => {
      if (sessionTimeoutRef.current) {
        clearTimeout(sessionTimeoutRef.current);
      }
    };
  }, [sessionTimeout, onError]);

  return (
    <Box
      component="form"
      ref={formRef}
      onSubmit={handleSubmit}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        maxWidth: 400,
        width: '100%',
        p: 2
      }}
    >
      <Typography
        variant="h6"
        component="h2"
        gutterBottom
        sx={{ color: 'text.primary' }}
      >
        Two-Factor Authentication
      </Typography>

      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        Please enter the 6-digit verification code from your authenticator app.
      </Typography>

      {validationError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {validationError}
        </Alert>
      )}

      <TextField
        name="mfaCode"
        value={mfaCode}
        onChange={handleCodeChange}
        type="text"
        label="Verification Code"
        placeholder="Enter 6-digit code"
        required
        disabled={isSubmitting || !isSessionValid}
        error={!!validationError}
        helperText={validationError}
        inputProps={{
          'aria-label': 'Verification code',
          'aria-describedby': 'mfa-code-help',
          maxLength: MFA_CODE_LENGTH,
          pattern: '[0-9]*',
          inputMode: 'numeric',
          autoComplete: 'one-time-code'
        }}
      />

      <Button
        type="submit"
        variant="contained"
        color="primary"
        fullWidth
        disabled={!mfaCode || isSubmitting || !isSessionValid}
        loading={isSubmitting}
        loadingPosition="start"
        startIcon={isSubmitting ? <CircularProgress size={20} /> : undefined}
        aria-label="Verify code"
      >
        {isSubmitting ? 'Verifying...' : 'Verify'}
      </Button>

      {!isSessionValid && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          Your session has expired. Please refresh the page and try again.
        </Alert>
      )}
    </Box>
  );
};

export default MFAForm;