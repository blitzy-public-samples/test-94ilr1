/**
 * Main Dashboard Component
 * Version: 1.0.0
 * 
 * Implements Material Design 3.0 principles with comprehensive email management,
 * context analysis, and accessibility features (WCAG 2.1 Level AA compliant).
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Grid, Box, useMediaQuery, Skeleton } from '@mui/material';
import { useTheme } from '@mui/material/styles';

// Internal imports
import DashboardLayout from '../../layouts/DashboardLayout';
import EmailList from '../../components/email/EmailList';
import ContextPanel from '../../components/context/ContextPanel';
import { useEmail } from '../../hooks/useEmail';
import { useNotification } from '../../hooks/useNotification';
import { IEmailMessage, EmailFilter, EmailStatus } from '../../types/email.types';
import { SortOrder } from '../../types/api.types';

// Constants
const CONTEXT_PANEL_WIDTH = 320;
const MOBILE_BREAKPOINT = 768;
const VIRTUALIZATION_CONFIG = {
  overscanRowCount: 5,
  rowHeight: 72,
  threshold: 0.8
};

/**
 * Dashboard state interface
 */
interface DashboardState {
  selectedEmailId: string | null;
  isContextPanelOpen: boolean;
  emailFilter: EmailFilter;
  error: Error | null;
  isLoading: boolean;
}

/**
 * Main Dashboard component with comprehensive email management
 */
const Dashboard: React.FC = React.memo(() => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { showNotification } = useNotification();

  // Initialize state
  const [state, setState] = useState<DashboardState>({
    selectedEmailId: null,
    isContextPanelOpen: !isMobile,
    emailFilter: {
      status: EmailStatus.UNREAD,
      priority: undefined,
      fromDate: undefined,
      toDate: undefined,
      searchTerm: ''
    },
    error: null,
    isLoading: false
  });

  // Initialize email hook with auto-refresh
  const {
    emails,
    loading,
    error,
    fetchEmails,
    refreshEmails
  } = useEmail({
    autoRefresh: true,
    refreshInterval: 30000,
    errorRetryCount: 3
  });

  // Handle email selection
  const handleEmailSelect = useCallback((email: IEmailMessage) => {
    setState(prev => ({
      ...prev,
      selectedEmailId: email.messageId,
      isContextPanelOpen: true
    }));
  }, []);

  // Handle context panel toggle
  const handleContextPanelToggle = useCallback(() => {
    setState(prev => ({
      ...prev,
      isContextPanelOpen: !prev.isContextPanelOpen
    }));
  }, []);

  // Handle filter changes
  const handleFilterChange = useCallback((newFilter: EmailFilter) => {
    setState(prev => ({
      ...prev,
      emailFilter: newFilter
    }));
    fetchEmails(newFilter);
  }, [fetchEmails]);

  // Handle errors
  const handleError = useCallback((error: Error) => {
    setState(prev => ({ ...prev, error }));
    showNotification('error', error.message, {
      duration: 5000,
      priority: 'high'
    });
  }, [showNotification]);

  // Set up keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) {
        switch (event.key.toLowerCase()) {
          case 'p':
            event.preventDefault();
            handleContextPanelToggle();
            break;
          case 'r':
            event.preventDefault();
            refreshEmails();
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleContextPanelToggle, refreshEmails]);

  // Compute responsive layout
  const layoutConfig = useMemo(() => ({
    mainContent: {
      width: state.isContextPanelOpen && !isMobile 
        ? `calc(100% - ${CONTEXT_PANEL_WIDTH}px)` 
        : '100%',
      transition: theme.transitions.create(['width', 'margin'], {
        easing: theme.transitions.easing.sharp,
        duration: theme.transitions.duration.leavingScreen,
      })
    },
    contextPanel: {
      width: CONTEXT_PANEL_WIDTH,
      display: state.isContextPanelOpen ? 'block' : 'none'
    }
  }), [state.isContextPanelOpen, isMobile, theme.transitions]);

  return (
    <DashboardLayout>
      <Box
        component="main"
        sx={{
          display: 'flex',
          height: '100%',
          overflow: 'hidden',
          backgroundColor: theme.palette.background.default
        }}
        role="main"
        aria-label="Email Dashboard"
      >
        <Grid container spacing={0} sx={{ height: '100%' }}>
          {/* Main Content */}
          <Grid 
            item 
            xs={12} 
            sx={layoutConfig.mainContent}
          >
            {loading && !emails.length ? (
              // Loading skeleton
              <Box p={2}>
                {[...Array(5)].map((_, i) => (
                  <Skeleton
                    key={i}
                    variant="rectangular"
                    height={VIRTUALIZATION_CONFIG.rowHeight}
                    sx={{ my: 1, borderRadius: 1 }}
                  />
                ))}
              </Box>
            ) : (
              <EmailList
                selectedEmailId={state.selectedEmailId}
                onEmailSelect={handleEmailSelect}
                filter={state.emailFilter}
                sortOrder={SortOrder.DESC}
                virtualization={VIRTUALIZATION_CONFIG}
                accessibility={{
                  announceUpdates: true,
                  enableKeyboardNav: true,
                  ariaLabels: {
                    listLabel: 'Email list',
                    loadingText: 'Loading emails',
                    errorText: 'Error loading emails',
                    noEmailsText: 'No emails found'
                  }
                }}
              />
            )}
          </Grid>

          {/* Context Panel */}
          <Grid 
            item 
            sx={layoutConfig.contextPanel}
          >
            <ContextPanel
              emailId={state.selectedEmailId}
              open={state.isContextPanelOpen}
              width={CONTEXT_PANEL_WIDTH}
              onClose={handleContextPanelToggle}
              onError={handleError}
              ariaLabel="Email context panel"
            />
          </Grid>
        </Grid>
      </Box>
    </DashboardLayout>
  );
});

// Display name for debugging
Dashboard.displayName = 'Dashboard';

export default Dashboard;