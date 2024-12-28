import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { Box, useMediaQuery, Skeleton, Alert } from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import { styled } from '@mui/material/styles';

// Internal imports
import Layout from '../../components/layout/Layout';
import EmailList from '../../components/email/EmailList';
import ContextPanel from '../../components/context/ContextPanel';
import { useEmail } from '../../hooks/useEmail';
import { IEmailMessage, EmailFilter } from '../../types/email.types';
import { SortOrder } from '../../types/api.types';

// Constants
const CONTEXT_PANEL_WIDTH = 400;
const MOBILE_BREAKPOINT = 768;
const VIRTUALIZATION_CONFIG = {
  itemSize: 72,
  overscanCount: 5,
  threshold: 0.8
};
const WS_RECONNECT_DELAY = 3000;

// Props interface
interface InboxProps {
  filter: EmailFilter;
  initialEmailId?: string | null;
}

// Styled components
const InboxContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'row',
  height: '100%',
  width: '100%',
  overflow: 'hidden',
  position: 'relative',
  backgroundColor: theme.palette.background.default,
  [theme.breakpoints.down('sm')]: {
    flexDirection: 'column',
  },
}));

const EmailListContainer = styled(Box)(({ theme }) => ({
  flexGrow: 1,
  height: '100%',
  overflow: 'auto',
  position: 'relative',
  role: 'region',
  'aria-label': 'Email list',
  borderRight: `1px solid ${theme.palette.divider}`,
  [theme.breakpoints.down('sm')]: {
    borderRight: 'none',
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
}));

// Main component
const Inbox: React.FC<InboxProps> = React.memo(({ filter, initialEmailId }) => {
  const navigate = useNavigate();
  const { emailId } = useParams();
  const isMobile = useMediaQuery(`(max-width:${MOBILE_BREAKPOINT}px)`);

  // State
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(
    initialEmailId || emailId || null
  );
  const [isContextPanelOpen, setIsContextPanelOpen] = useState(!isMobile && !!selectedEmailId);

  // Hooks
  const {
    emails,
    loading,
    error,
    fetchEmails,
    refreshEmails,
    clearError
  } = useEmail({
    autoRefresh: true,
    refreshInterval: WS_RECONNECT_DELAY,
    errorRetryCount: 3
  });

  // Memoized virtualization config
  const virtualizedConfig = useMemo(() => ({
    ...VIRTUALIZATION_CONFIG,
    rowHeight: isMobile ? 80 : VIRTUALIZATION_CONFIG.itemSize
  }), [isMobile]);

  // Handle email selection
  const handleEmailSelect = useCallback((email: IEmailMessage) => {
    setSelectedEmailId(email.messageId);
    setIsContextPanelOpen(true);
    navigate(`/email/inbox/${email.messageId}`);
  }, [navigate]);

  // Handle context panel close
  const handleContextPanelClose = useCallback(() => {
    setIsContextPanelOpen(false);
    if (isMobile) {
      setSelectedEmailId(null);
      navigate('/email/inbox');
    }
  }, [isMobile, navigate]);

  // Handle context panel error
  const handleContextError = useCallback((error: Error) => {
    console.error('Context panel error:', error);
  }, []);

  // Effect for URL sync
  useEffect(() => {
    if (emailId && emailId !== selectedEmailId) {
      setSelectedEmailId(emailId);
      setIsContextPanelOpen(true);
    }
  }, [emailId, selectedEmailId]);

  // Effect for mobile view adjustments
  useEffect(() => {
    if (isMobile && isContextPanelOpen) {
      setIsContextPanelOpen(false);
    }
  }, [isMobile]);

  return (
    <Layout>
      <InboxContainer>
        <EmailListContainer>
          {loading && !emails.length ? (
            <Box p={2}>
              <Skeleton variant="rectangular" height={72} />
              <Skeleton variant="rectangular" height={72} sx={{ mt: 1 }} />
              <Skeleton variant="rectangular" height={72} sx={{ mt: 1 }} />
            </Box>
          ) : error ? (
            <Alert 
              severity="error" 
              onClose={clearError}
              sx={{ m: 2 }}
            >
              {error}
            </Alert>
          ) : (
            <EmailList
              selectedEmailId={selectedEmailId}
              onEmailSelect={handleEmailSelect}
              filter={filter}
              sortOrder={SortOrder.DESC}
              refreshInterval={WS_RECONNECT_DELAY}
              virtualizedConfig={virtualizedConfig}
              accessibility={{
                announceUpdates: true,
                enableKeyboardNav: true,
                ariaLabels: {
                  listLabel: 'Email inbox',
                  loadingText: 'Loading emails',
                  errorText: 'Error loading emails',
                  noEmailsText: 'No emails found'
                }
              }}
            />
          )}
        </EmailListContainer>

        <ContextPanel
          emailId={selectedEmailId}
          open={isContextPanelOpen}
          width={CONTEXT_PANEL_WIDTH}
          onClose={handleContextPanelClose}
          onError={handleContextError}
          ariaLabel="Email context panel"
        />
      </InboxContainer>
    </Layout>
  );
});

Inbox.displayName = 'Inbox';

export default Inbox;