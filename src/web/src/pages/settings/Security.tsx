import React, { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { ErrorBoundary } from '@sentry/react'; // v7.0.0

// Internal imports
import SettingsLayout from '../../layouts/SettingsLayout';
import SecuritySettings from '../../components/settings/SecuritySettings';
import useAuth from '../../hooks/useAuth';
import { ROUTES } from '../../constants/routes.constants';

/**
 * Security settings page component with route protection and accessibility features.
 * Implements comprehensive security event tracking and error handling.
 */
const SecurityPage: React.FC = React.memo(() => {
  const { user, isAuthenticated, isLoading } = useAuth();

  // Track page view for security monitoring
  useEffect(() => {
    if (isAuthenticated && user) {
      // Track security settings page access
      window.analytics?.track('Security Settings View', {
        userId: user.id,
        timestamp: new Date().toISOString(),
        userRole: user.roles[0]
      });
    }
  }, [isAuthenticated, user]);

  // Handle security setting changes
  const handleSettingChange = async (setting: string, value: any) => {
    try {
      // Track security setting modification attempt
      window.analytics?.track('Security Setting Change', {
        userId: user?.id,
        setting,
        newValue: value,
        timestamp: new Date().toISOString()
      });

      // Additional security logging can be implemented here
      console.info(`Security setting "${setting}" changed to:`, value);
    } catch (error) {
      // Log security setting change failure
      console.error('Failed to update security setting:', error);
      throw error;
    }
  };

  // Handle security-related errors
  const handleError = (error: Error) => {
    // Track security setting error
    window.analytics?.track('Security Setting Error', {
      userId: user?.id,
      error: error.message,
      timestamp: new Date().toISOString()
    });

    console.error('Security settings error:', error);
  };

  // Protect route - redirect to login if not authenticated
  if (!isAuthenticated && !isLoading) {
    return <Navigate to={ROUTES.AUTH.LOGIN} replace />;
  }

  return (
    <ErrorBoundary
      fallback={({ error }) => (
        <div role="alert" aria-live="assertive">
          <h2>Error Loading Security Settings</h2>
          <p>{error.message}</p>
        </div>
      )}
    >
      <SettingsLayout>
        <div
          role="main"
          aria-label="Security Settings Page"
          className="security-page"
        >
          <SecuritySettings
            onSettingChange={handleSettingChange}
            onError={handleError}
          />
        </div>
      </SettingsLayout>
    </ErrorBoundary>
  );
});

// Display name for debugging
SecurityPage.displayName = 'SecurityPage';

export default SecurityPage;