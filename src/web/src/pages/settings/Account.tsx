import React, { useCallback, useState, useEffect } from 'react';
import { Container } from '@mui/material'; // v5.14.0
import { debounce } from 'lodash'; // v4.17.21

// Internal imports
import SettingsLayout from '../../layouts/SettingsLayout';
import AccountSettings from '../../components/settings/AccountSettings';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';

/**
 * Account Settings Page Component
 * 
 * Provides secure user profile management functionality with enhanced authentication,
 * accessibility, and responsive design features.
 */
const AccountPage: React.FC = React.memo(() => {
  // Hooks for authentication and notifications
  const { user, updateUser, validateSession } = useAuth();
  const { showNotification, showError } = useNotification();
  
  // Loading state management
  const [isLoading, setIsLoading] = useState(false);

  // Session validation on mount
  useEffect(() => {
    const validateUserSession = async () => {
      try {
        const isValid = await validateSession();
        if (!isValid) {
          showError('Invalid session. Please re-authenticate.');
        }
      } catch (error) {
        showError('Session validation failed. Please try again.');
      }
    };

    validateUserSession();
  }, [validateSession, showError]);

  // Debounced validation handler
  const handleValidation = useCallback(
    debounce(async (updatedUser) => {
      try {
        await validateSession();
      } catch (error) {
        showError('Session validation failed during update.');
      }
    }, 500),
    [validateSession, showError]
  );

  // Profile update handler with security measures
  const handleSaveProfile = useCallback(async (updatedUser) => {
    try {
      setIsLoading(true);

      // Validate session before update
      const isValid = await validateSession();
      if (!isValid) {
        throw new Error('Invalid session. Please re-authenticate.');
      }

      // Update user profile
      await updateUser(updatedUser);

      showNotification('success', 'Profile updated successfully', {
        duration: 5000,
        ariaLabel: 'Profile update success message'
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update profile';
      showError(errorMessage, {
        duration: 7000,
        ariaLabel: 'Profile update error message'
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [updateUser, validateSession, showNotification, showError]);

  // Error handler for account settings
  const handleError = useCallback((error: Error) => {
    showError(error.message, {
      duration: 7000,
      ariaLabel: 'Account settings error message'
    });
  }, [showError]);

  return (
    <SettingsLayout>
      <Container maxWidth="md" sx={{ py: 3 }}>
        <AccountSettings
          onSave={handleSaveProfile}
          onError={handleError}
          validationRules={{
            nameMinLength: 2,
            nameMaxLength: 50,
            maxPreferencesSize: 1024 * 10 // 10KB limit
          }}
        />
      </Container>
    </SettingsLayout>
  );
});

// Display name for debugging
AccountPage.displayName = 'AccountPage';

export default AccountPage;