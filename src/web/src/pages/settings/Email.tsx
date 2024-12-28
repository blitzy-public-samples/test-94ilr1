import React, { useCallback, useEffect, useState } from 'react';
import { useMediaQuery } from '@mui/material'; // v5.14.0

// Internal imports
import SettingsLayout from '../../layouts/SettingsLayout';
import EmailSettings from '../../components/settings/EmailSettings';
import { EmailService } from '../../services/email.service';
import useAuth from '../../hooks/useAuth';
import useNotification from '../../hooks/useNotification';

/**
 * Email Settings Page Component
 * Provides comprehensive configuration options for email accounts, automated responses,
 * real-time monitoring, thread analysis, and email preferences.
 */
const EmailPage: React.FC = React.memo(() => {
  // Hooks
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const isMobile = useMediaQuery((theme) => theme.breakpoints.down('sm'));

  // State
  const [emailService] = useState(() => new EmailService());
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Handles settings changes with validation and persistence
   */
  const handleSettingsChange = useCallback(async (settings: any) => {
    try {
      // Update email service settings
      await emailService.updateEmailStatus({
        autoResponse: settings.autoResponse,
        responseDelay: settings.responseDelay,
        monitoringEnabled: settings.notificationPreferences.email,
        threadAnalysis: true
      });

      // Update filter preferences
      await emailService.updateFilter({
        priority: settings.priority,
        categories: settings.categories
      });

      // Update monitoring preferences
      await emailService.updateMonitoringPreferences({
        email: settings.notificationPreferences.email,
        push: settings.notificationPreferences.push,
        inApp: settings.notificationPreferences.inApp
      });

      // Update thread analysis settings
      await emailService.updateThreadAnalysis({
        enabled: true,
        depth: settings.analysisDepth || 'full',
        contextTracking: true
      });

      showNotification('success', 'Email settings updated successfully', {
        duration: 3000,
        ariaLabel: 'Settings saved confirmation'
      });
    } catch (error) {
      console.error('Failed to update email settings:', error);
      showNotification('error', 'Failed to update email settings', {
        duration: 5000,
        ariaLabel: 'Settings update error'
      });
    }
  }, [emailService, showNotification]);

  /**
   * Initialize component with user settings
   */
  useEffect(() => {
    const initializeSettings = async () => {
      try {
        setIsLoading(true);
        // Load user's email settings
        await emailService.syncSettings();
      } catch (error) {
        console.error('Failed to load email settings:', error);
        showNotification('error', 'Failed to load email settings', {
          duration: 5000,
          ariaLabel: 'Settings loading error'
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      initializeSettings();
    }

    return () => {
      // Cleanup subscriptions and monitoring
      emailService.cleanup();
    };
  }, [user, emailService, showNotification]);

  return (
    <SettingsLayout>
      <EmailSettings
        emailService={emailService}
        onSettingsChange={handleSettingsChange}
        initialSettings={{
          autoResponse: false,
          signature: user?.preferences?.emailSignature || '',
          responseDelay: 5,
          notificationPreferences: {
            email: true,
            push: true,
            inApp: true
          }
        }}
      />
    </SettingsLayout>
  );
});

// Display name for debugging
EmailPage.displayName = 'EmailPage';

export default EmailPage;