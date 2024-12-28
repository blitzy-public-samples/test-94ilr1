import React, { useCallback } from 'react';
import { Box, Container, Typography, CircularProgress, useTheme } from '@mui/material'; // v5.14.0
import { ErrorBoundary } from 'react-error-boundary'; // v4.0.0

// Internal imports
import SettingsLayout from '../../layouts/SettingsLayout';
import NotificationSettings from '../../components/settings/NotificationSettings';
import { useNotification } from '../../hooks/useNotification';

/**
 * Error fallback component for the notification settings page
 */
const ErrorFallback = ({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) => {
  const { showNotification } = useNotification();

  React.useEffect(() => {
    showNotification('error', 'Failed to load notification settings', {
      duration: 5000,
      ariaLabel: 'Error loading notification settings'
    });
  }, [showNotification]);

  return (
    <Box
      sx={{
        p: 3,
        textAlign: 'center',
        color: 'error.main'
      }}
      role="alert"
    >
      <Typography variant="h6" gutterBottom>
        Error Loading Settings
      </Typography>
      <Typography variant="body2" sx={{ mb: 2 }}>
        {error.message}
      </Typography>
      <button onClick={resetErrorBoundary}>Retry</button>
    </Box>
  );
};

/**
 * NotificationsPage component for managing user notification preferences
 * Implements Material Design 3.0 principles with enhanced accessibility
 */
const NotificationsPage: React.FC = React.memo(() => {
  const theme = useTheme();
  const { showNotification } = useNotification();

  /**
   * Handles changes to notification settings
   */
  const handleSettingsChange = useCallback((settings: any) => {
    showNotification('success', 'Notification settings updated', {
      duration: 3000,
      ariaLabel: 'Notification settings have been updated successfully'
    });
  }, [showNotification]);

  return (
    <SettingsLayout>
      <ErrorBoundary
        FallbackComponent={ErrorFallback}
        onReset={() => {
          // Reset any state that might have caused the error
          window.location.reload();
        }}
      >
        <Container
          maxWidth="md"
          sx={{
            py: { xs: 2, sm: 3 },
            px: { xs: 2, sm: 3 },
            [theme.breakpoints.down('sm')]: {
              px: 1
            }
          }}
        >
          <Box
            component="section"
            role="region"
            aria-label="Notification Settings"
            sx={{ mb: 4 }}
          >
            <Typography
              variant="h4"
              component="h1"
              gutterBottom
              sx={{
                mb: 3,
                fontWeight: theme.typography.fontWeightMedium
              }}
            >
              Notification Settings
            </Typography>

            <Typography
              variant="body1"
              color="text.secondary"
              sx={{ mb: 4 }}
            >
              Manage how you receive notifications and updates from the system.
            </Typography>

            <React.Suspense
              fallback={
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    minHeight: 200
                  }}
                >
                  <CircularProgress 
                    aria-label="Loading notification settings"
                    size={40}
                  />
                </Box>
              }
            >
              <NotificationSettings
                onSettingsChange={handleSettingsChange}
                className="notification-settings-panel"
              />
            </React.Suspense>
          </Box>
        </Container>
      </ErrorBoundary>
    </SettingsLayout>
  );
});

// Display name for debugging
NotificationsPage.displayName = 'NotificationsPage';

export default NotificationsPage;