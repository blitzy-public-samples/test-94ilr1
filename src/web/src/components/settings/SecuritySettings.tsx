// @mui/material v5.14.0
// @mui/icons-material v5.14.0
// react v18.2.0
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  TextField,
  Switch,
  Button,
  Typography,
  Grid,
  Dialog,
  CircularProgress,
  Alert,
  FormControlLabel,
  Divider,
  Box
} from '@mui/material';
import {
  SecurityIcon,
  LockIcon,
  VpnKeyIcon,
  NotificationsIcon,
  HistoryIcon
} from '@mui/icons-material';
import Card from '../common/Card';
import { useAuth } from '../../hooks/useAuth';

// Interface for component props
interface SecuritySettingsProps {
  onSettingChange?: (setting: string, value: any) => Promise<void>;
  onError?: (error: Error) => void;
}

// Interface for security settings state
interface SecuritySettingsState {
  mfaEnabled: boolean;
  sessionTimeout: number;
  passwordExpiryDays: number;
  loginNotifications: boolean;
  loading: boolean;
  errors: Record<string, string>;
  showConfirmDialog: boolean;
  pendingChange: { setting: string; value: any } | null;
}

// Rate limiting configuration
const RATE_LIMIT_DELAY = 1000; // 1 second between setting changes

// Security validation rules
const VALIDATION_RULES = {
  sessionTimeout: { min: 5, max: 120 }, // minutes
  passwordExpiryDays: { min: 30, max: 180 }, // days
};

/**
 * Enhanced SecuritySettings component with comprehensive security features
 * and WCAG 2.1 Level AA compliance
 */
const SecuritySettings: React.FC<SecuritySettingsProps> = React.memo(({ 
  onSettingChange,
  onError 
}) => {
  // State management
  const [state, setState] = useState<SecuritySettingsState>({
    mfaEnabled: false,
    sessionTimeout: 30,
    passwordExpiryDays: 90,
    loginNotifications: true,
    loading: false,
    errors: {},
    showConfirmDialog: false,
    pendingChange: null
  });

  // Auth hook for user context and security operations
  const { user, validateSession } = useAuth();

  // Rate limiting ref
  const lastChangeTime = useRef<number>(0);

  // Validation helper
  const validateSecurityInput = (setting: string, value: any): { valid: boolean; error?: string } => {
    switch (setting) {
      case 'sessionTimeout':
        if (value < VALIDATION_RULES.sessionTimeout.min || value > VALIDATION_RULES.sessionTimeout.max) {
          return {
            valid: false,
            error: `Session timeout must be between ${VALIDATION_RULES.sessionTimeout.min} and ${VALIDATION_RULES.sessionTimeout.max} minutes`
          };
        }
        break;
      case 'passwordExpiryDays':
        if (value < VALIDATION_RULES.passwordExpiryDays.min || value > VALIDATION_RULES.passwordExpiryDays.max) {
          return {
            valid: false,
            error: `Password expiry must be between ${VALIDATION_RULES.passwordExpiryDays.min} and ${VALIDATION_RULES.passwordExpiryDays.max} days`
          };
        }
        break;
    }
    return { valid: true };
  };

  // Setting change handler with rate limiting and validation
  const handleSettingChange = useCallback(async (setting: string, value: any) => {
    try {
      // Rate limiting check
      const now = Date.now();
      if (now - lastChangeTime.current < RATE_LIMIT_DELAY) {
        throw new Error('Please wait before making another change');
      }
      lastChangeTime.current = now;

      // Session validation
      const isSessionValid = await validateSession();
      if (!isSessionValid) {
        throw new Error('Your session has expired. Please log in again.');
      }

      // Input validation
      const validation = validateSecurityInput(setting, value);
      if (!validation.valid) {
        setState(prev => ({
          ...prev,
          errors: { ...prev.errors, [setting]: validation.error! }
        }));
        return;
      }

      // Critical setting changes require confirmation
      if (['mfaEnabled', 'sessionTimeout'].includes(setting)) {
        setState(prev => ({
          ...prev,
          showConfirmDialog: true,
          pendingChange: { setting, value }
        }));
        return;
      }

      // Apply the change
      setState(prev => ({ ...prev, loading: true, errors: {} }));
      await onSettingChange?.(setting, value);
      
      setState(prev => ({
        ...prev,
        [setting]: value,
        loading: false,
        errors: {}
      }));

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';
      setState(prev => ({
        ...prev,
        loading: false,
        errors: { ...prev.errors, [setting]: errorMessage }
      }));
      onError?.(error as Error);
    }
  }, [onSettingChange, onError, validateSession]);

  // Confirmation dialog handlers
  const handleConfirm = async () => {
    if (state.pendingChange) {
      const { setting, value } = state.pendingChange;
      setState(prev => ({ ...prev, showConfirmDialog: false, pendingChange: null }));
      await handleSettingChange(setting, value);
    }
  };

  const handleCancel = () => {
    setState(prev => ({ ...prev, showConfirmDialog: false, pendingChange: null }));
  };

  // Initialize settings from user data
  useEffect(() => {
    if (user) {
      setState(prev => ({
        ...prev,
        mfaEnabled: user.mfaEnabled || false,
        sessionTimeout: user.preferences?.sessionTimeout || 30,
        passwordExpiryDays: user.preferences?.passwordExpiryDays || 90,
        loginNotifications: user.preferences?.notifications?.login || true
      }));
    }
  }, [user]);

  return (
    <Box role="region" aria-label="Security Settings">
      {/* MFA Configuration */}
      <Card
        aria-labelledby="mfa-settings-title"
        className="security-section"
      >
        <Grid container spacing={3} alignItems="center">
          <Grid item>
            <SecurityIcon color="primary" fontSize="large" />
          </Grid>
          <Grid item xs>
            <Typography variant="h6" id="mfa-settings-title">
              Multi-Factor Authentication
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Enable additional security layer with MFA
            </Typography>
          </Grid>
          <Grid item>
            <FormControlLabel
              control={
                <Switch
                  checked={state.mfaEnabled}
                  onChange={(e) => handleSettingChange('mfaEnabled', e.target.checked)}
                  color="primary"
                  inputProps={{
                    'aria-label': 'Toggle MFA',
                    role: 'switch'
                  }}
                />
              }
              label={state.mfaEnabled ? 'Enabled' : 'Disabled'}
            />
          </Grid>
        </Grid>
        {state.errors.mfaEnabled && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {state.errors.mfaEnabled}
          </Alert>
        )}
      </Card>

      {/* Session Management */}
      <Card
        aria-labelledby="session-settings-title"
        className="security-section"
        sx={{ mt: 3 }}
      >
        <Grid container spacing={3}>
          <Grid item>
            <HistoryIcon color="primary" fontSize="large" />
          </Grid>
          <Grid item xs={12} sm>
            <Typography variant="h6" id="session-settings-title">
              Session Management
            </Typography>
            <TextField
              type="number"
              label="Session Timeout (minutes)"
              value={state.sessionTimeout}
              onChange={(e) => handleSettingChange('sessionTimeout', parseInt(e.target.value))}
              fullWidth
              margin="normal"
              inputProps={{
                min: VALIDATION_RULES.sessionTimeout.min,
                max: VALIDATION_RULES.sessionTimeout.max,
                'aria-label': 'Session timeout in minutes'
              }}
              error={!!state.errors.sessionTimeout}
              helperText={state.errors.sessionTimeout}
            />
          </Grid>
        </Grid>
      </Card>

      {/* Password Policy */}
      <Card
        aria-labelledby="password-settings-title"
        className="security-section"
        sx={{ mt: 3 }}
      >
        <Grid container spacing={3}>
          <Grid item>
            <LockIcon color="primary" fontSize="large" />
          </Grid>
          <Grid item xs={12} sm>
            <Typography variant="h6" id="password-settings-title">
              Password Policy
            </Typography>
            <TextField
              type="number"
              label="Password Expiry (days)"
              value={state.passwordExpiryDays}
              onChange={(e) => handleSettingChange('passwordExpiryDays', parseInt(e.target.value))}
              fullWidth
              margin="normal"
              inputProps={{
                min: VALIDATION_RULES.passwordExpiryDays.min,
                max: VALIDATION_RULES.passwordExpiryDays.max,
                'aria-label': 'Password expiry in days'
              }}
              error={!!state.errors.passwordExpiryDays}
              helperText={state.errors.passwordExpiryDays}
            />
          </Grid>
        </Grid>
      </Card>

      {/* Security Notifications */}
      <Card
        aria-labelledby="notification-settings-title"
        className="security-section"
        sx={{ mt: 3 }}
      >
        <Grid container spacing={3} alignItems="center">
          <Grid item>
            <NotificationsIcon color="primary" fontSize="large" />
          </Grid>
          <Grid item xs>
            <Typography variant="h6" id="notification-settings-title">
              Security Notifications
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Receive alerts for login attempts and security events
            </Typography>
          </Grid>
          <Grid item>
            <FormControlLabel
              control={
                <Switch
                  checked={state.loginNotifications}
                  onChange={(e) => handleSettingChange('loginNotifications', e.target.checked)}
                  color="primary"
                  inputProps={{
                    'aria-label': 'Toggle login notifications',
                    role: 'switch'
                  }}
                />
              }
              label={state.loginNotifications ? 'Enabled' : 'Disabled'}
            />
          </Grid>
        </Grid>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog
        open={state.showConfirmDialog}
        onClose={handleCancel}
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
      >
        <Box sx={{ p: 3 }}>
          <Typography id="confirm-dialog-title" variant="h6" gutterBottom>
            Confirm Security Change
          </Typography>
          <Typography id="confirm-dialog-description" variant="body1" sx={{ mb: 3 }}>
            Are you sure you want to change this security setting? This may affect your account's security level.
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
            <Button
              onClick={handleCancel}
              color="inherit"
              aria-label="Cancel security change"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              variant="contained"
              color="primary"
              aria-label="Confirm security change"
            >
              Confirm
            </Button>
          </Box>
        </Box>
      </Dialog>

      {/* Loading Overlay */}
      {state.loading && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.7)',
            zIndex: 1
          }}
        >
          <CircularProgress aria-label="Loading" />
        </Box>
      )}
    </Box>
  );
});

SecuritySettings.displayName = 'SecuritySettings';

export default SecuritySettings;