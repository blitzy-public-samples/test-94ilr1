// External dependencies
// react v18.2+
import React, { useState, useEffect, useCallback, useRef } from 'react';
// @mui/material v5.14+
import {
  Card,
  CardContent,
  Switch,
  FormControlLabel,
  Typography,
  CircularProgress,
  Alert,
  Box,
  Divider,
  Select,
  MenuItem,
  FormControl,
  InputLabel
} from '@mui/material';
// lodash v4.17+
import { debounce } from 'lodash';

// Internal imports
import { TextField } from '../common/TextField';
import { useAuth } from '../../hooks/useAuth';
import { EmailService } from '../../services/email.service';

// Types and interfaces
interface EmailSettingsProps {
  emailService: EmailService;
  onSettingsChange: (settings: EmailSettingsType) => void;
  initialSettings?: EmailSettingsType;
}

interface EmailSettingsType {
  autoResponse: boolean;
  signature: string;
  responseDelay: number;
  notificationPreferences: NotificationPreferences;
}

interface NotificationPreferences {
  email: boolean;
  push: boolean;
  inApp: boolean;
}

// Default settings
const defaultSettings: EmailSettingsType = {
  autoResponse: false,
  signature: '',
  responseDelay: 5,
  notificationPreferences: {
    email: true,
    push: true,
    inApp: true
  }
};

// Response delay options (in minutes)
const RESPONSE_DELAY_OPTIONS = [1, 2, 5, 10, 15, 30];

/**
 * EmailSettings Component
 * Provides configuration interface for email-related settings with enhanced validation
 * and real-time synchronization capabilities.
 */
export const EmailSettings: React.FC<EmailSettingsProps> = ({
  emailService,
  onSettingsChange,
  initialSettings
}) => {
  // Authentication hook for secure operations
  const { user } = useAuth();

  // Component state
  const [settings, setSettings] = useState<EmailSettingsType>(
    initialSettings || defaultSettings
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Refs for cleanup
  const saveTimeoutRef = useRef<NodeJS.Timeout>();

  // Debounced save function
  const debouncedSave = useCallback(
    debounce(async (newSettings: EmailSettingsType) => {
      try {
        setLoading(true);
        setError(null);
        
        // Validate settings before saving
        const validationResult = await emailService.validateSettings(newSettings);
        if (!validationResult.isValid) {
          throw new Error(validationResult.error);
        }

        // Update settings on the server
        await emailService.updateEmailSettings(newSettings);
        
        // Notify parent component
        onSettingsChange(newSettings);
        
        setSaveSuccess(true);
        setIsDirty(false);

        // Clear success message after 3 seconds
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }
        saveTimeoutRef.current = setTimeout(() => {
          setSaveSuccess(false);
        }, 3000);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save settings');
      } finally {
        setLoading(false);
      }
    }, 500),
    [emailService, onSettingsChange]
  );

  // Effect for settings synchronization
  useEffect(() => {
    const syncSettings = async () => {
      try {
        setLoading(true);
        const syncedSettings = await emailService.syncSettings();
        setSettings(syncedSettings);
      } catch (err) {
        setError('Failed to sync settings');
      } finally {
        setLoading(false);
      }
    };

    syncSettings();

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [emailService]);

  // Handlers
  const handleAutoResponseToggle = useCallback(async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const newSettings = {
      ...settings,
      autoResponse: event.target.checked
    };
    setSettings(newSettings);
    setIsDirty(true);
    await debouncedSave(newSettings);
  }, [settings, debouncedSave]);

  const handleSignatureChange = useCallback(async (value: string) => {
    const newSettings = {
      ...settings,
      signature: value
    };
    setSettings(newSettings);
    setIsDirty(true);
    await debouncedSave(newSettings);
  }, [settings, debouncedSave]);

  const handleResponseDelayChange = useCallback(async (
    event: React.ChangeEvent<{ value: unknown }>
  ) => {
    const newSettings = {
      ...settings,
      responseDelay: event.target.value as number
    };
    setSettings(newSettings);
    setIsDirty(true);
    await debouncedSave(newSettings);
  }, [settings, debouncedSave]);

  const handleNotificationToggle = useCallback(async (
    type: keyof NotificationPreferences
  ) => {
    const newSettings = {
      ...settings,
      notificationPreferences: {
        ...settings.notificationPreferences,
        [type]: !settings.notificationPreferences[type]
      }
    };
    setSettings(newSettings);
    setIsDirty(true);
    await debouncedSave(newSettings);
  }, [settings, debouncedSave]);

  return (
    <Card elevation={2}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Email Settings
        </Typography>
        
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        {saveSuccess && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Settings saved successfully
          </Alert>
        )}

        <Box sx={{ mb: 3 }}>
          <FormControlLabel
            control={
              <Switch
                checked={settings.autoResponse}
                onChange={handleAutoResponseToggle}
                disabled={loading}
              />
            }
            label="Enable Automatic Responses"
          />
        </Box>

        <Divider sx={{ my: 2 }} />

        <Box sx={{ mb: 3 }}>
          <FormControl fullWidth>
            <InputLabel>Response Delay</InputLabel>
            <Select
              value={settings.responseDelay}
              onChange={handleResponseDelayChange}
              disabled={loading || !settings.autoResponse}
              label="Response Delay"
            >
              {RESPONSE_DELAY_OPTIONS.map((delay) => (
                <MenuItem key={delay} value={delay}>
                  {delay} minute{delay !== 1 ? 's' : ''}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <Box sx={{ mb: 3 }}>
          <TextField
            name="signature"
            label="Email Signature"
            value={settings.signature}
            onChange={(value) => handleSignatureChange(value)}
            multiline
            rows={4}
            fullWidth
            disabled={loading}
            helperText="HTML formatting is supported"
          />
        </Box>

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle1" gutterBottom>
          Notification Preferences
        </Typography>

        <Box>
          <FormControlLabel
            control={
              <Switch
                checked={settings.notificationPreferences.email}
                onChange={() => handleNotificationToggle('email')}
                disabled={loading}
              />
            }
            label="Email Notifications"
          />
          
          <FormControlLabel
            control={
              <Switch
                checked={settings.notificationPreferences.push}
                onChange={() => handleNotificationToggle('push')}
                disabled={loading}
              />
            }
            label="Push Notifications"
          />
          
          <FormControlLabel
            control={
              <Switch
                checked={settings.notificationPreferences.inApp}
                onChange={() => handleNotificationToggle('inApp')}
                disabled={loading}
              />
            }
            label="In-App Notifications"
          />
        </Box>

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
            <CircularProgress size={24} />
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default EmailSettings;