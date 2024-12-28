// @mui/material version ^5.14.0
// react version ^18.2.0
// xss version ^1.0.14

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  CircularProgress,
  Alert,
  Box,
  Divider
} from '@mui/material';
import { useAuth } from '../../hooks/useAuth';
import { User } from '../../types/auth.types';
import TextField from '../common/TextField';
import { sanitizeInput } from '../../utils/validation.utils';

// Enhanced props interface with security features
interface AccountSettingsProps {
  onSave: (updatedUser: User) => Promise<void>;
  onError: (error: Error) => void;
  validationRules?: {
    nameMinLength?: number;
    nameMaxLength?: number;
    maxPreferencesSize?: number;
  };
}

// Form field validation interface
interface FormErrors {
  name?: string;
  email?: string;
  preferences?: string;
}

// Security status tracking interface
interface SecurityStatus {
  valid: boolean;
  message: string;
  lastChecked: Date;
}

/**
 * AccountSettings Component
 * 
 * A secure and accessible React component for managing user account settings
 * with comprehensive validation, real-time feedback, and enterprise-grade security features.
 * 
 * @param props - AccountSettingsProps
 */
export const AccountSettings: React.FC<AccountSettingsProps> = ({
  onSave,
  onError,
  validationRules = {
    nameMinLength: 2,
    nameMaxLength: 50,
    maxPreferencesSize: 1024 * 10 // 10KB limit for preferences
  }
}) => {
  // Auth hook for secure user management
  const { user, loading: authLoading, validateSession } = useAuth();

  // Form state management with security considerations
  const [formData, setFormData] = useState<Partial<User>>(user || {});
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const [securityStatus, setSecurityStatus] = useState<SecurityStatus>({
    valid: true,
    message: '',
    lastChecked: new Date()
  });

  // Security-focused refs
  const saveAttempts = useRef(0);
  const maxSaveAttempts = 3;
  const lastSaveAttempt = useRef<Date>();

  // Initialize form with sanitized user data
  useEffect(() => {
    if (user) {
      setFormData({
        id: user.id,
        name: sanitizeInput(user.name),
        email: sanitizeInput(user.email),
        preferences: user.preferences
      });
    }
  }, [user]);

  // Validate form data with enhanced security checks
  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};
    let isValid = true;

    // Name validation
    if (!formData.name || formData.name.length < validationRules.nameMinLength!) {
      newErrors.name = `Name must be at least ${validationRules.nameMinLength} characters`;
      isValid = false;
    } else if (formData.name.length > validationRules.nameMaxLength!) {
      newErrors.name = `Name cannot exceed ${validationRules.nameMaxLength} characters`;
      isValid = false;
    }

    // Email validation (readonly in UI but validated for security)
    if (formData.email !== user?.email) {
      newErrors.email = 'Email cannot be modified in this interface';
      isValid = false;
    }

    // Preferences size validation
    const preferencesSize = new Blob([JSON.stringify(formData.preferences)]).size;
    if (preferencesSize > validationRules.maxPreferencesSize!) {
      newErrors.preferences = 'Preferences data exceeds size limit';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  }, [formData, user, validationRules]);

  // Handle input changes with sanitization
  const handleInputChange = useCallback((field: keyof User, value: string) => {
    const sanitizedValue = sanitizeInput(value);
    setFormData(prev => ({
      ...prev,
      [field]: sanitizedValue
    }));
  }, []);

  // Handle form submission with security measures
  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();

    try {
      // Rate limiting check
      if (saveAttempts.current >= maxSaveAttempts) {
        const cooldownPeriod = 5 * 60 * 1000; // 5 minutes
        const timeSinceLastAttempt = lastSaveAttempt.current 
          ? new Date().getTime() - lastSaveAttempt.current.getTime()
          : cooldownPeriod;

        if (timeSinceLastAttempt < cooldownPeriod) {
          throw new Error('Too many save attempts. Please try again later.');
        }
        saveAttempts.current = 0;
      }

      // Session validation
      const isSessionValid = await validateSession();
      if (!isSessionValid) {
        throw new Error('Invalid session. Please re-authenticate.');
      }

      // Form validation
      if (!validateForm()) {
        return;
      }

      setIsSaving(true);
      saveAttempts.current++;
      lastSaveAttempt.current = new Date();

      // Prepare sanitized data for submission
      const sanitizedData: Partial<User> = {
        ...formData,
        name: sanitizeInput(formData.name || ''),
        preferences: formData.preferences
      };

      await onSave(sanitizedData as User);

      setSecurityStatus({
        valid: true,
        message: 'Settings updated successfully',
        lastChecked: new Date()
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';
      setSecurityStatus({
        valid: false,
        message: errorMessage,
        lastChecked: new Date()
      });
      onError(error as Error);
    } finally {
      setIsSaving(false);
    }
  };

  if (authLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Card>
      <CardContent>
        <Typography variant="h5" component="h2" gutterBottom>
          Account Settings
        </Typography>
        
        <Divider sx={{ my: 2 }} />

        <form onSubmit={handleSave} noValidate>
          <Grid container spacing={3}>
            {/* Name Field */}
            <Grid item xs={12}>
              <TextField
                name="name"
                label="Full Name"
                value={formData.name || ''}
                onChange={(value) => handleInputChange('name', value)}
                error={errors.name}
                required
                aria-label="Full Name"
                aria-describedby="name-error"
              />
            </Grid>

            {/* Email Field (Read-only) */}
            <Grid item xs={12}>
              <TextField
                name="email"
                label="Email Address"
                value={formData.email || ''}
                onChange={() => {}} // No-op as email is read-only
                disabled
                aria-label="Email Address"
              />
            </Grid>

            {/* Security Status Messages */}
            <Grid item xs={12}>
              {!securityStatus.valid && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {securityStatus.message}
                </Alert>
              )}
              {securityStatus.valid && securityStatus.message && (
                <Alert severity="success" sx={{ mb: 2 }}>
                  {securityStatus.message}
                </Alert>
              )}
            </Grid>

            {/* Action Buttons */}
            <Grid item xs={12}>
              <Box display="flex" justifyContent="flex-end" gap={2}>
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  disabled={isSaving || !securityStatus.valid}
                  aria-label="Save Changes"
                >
                  {isSaving ? (
                    <>
                      <CircularProgress size={20} sx={{ mr: 1 }} />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </form>
      </CardContent>
    </Card>
  );
};

export default AccountSettings;