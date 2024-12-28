import React, { useEffect, useCallback, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Box, 
  Container, 
  CircularProgress, 
  Alert, 
  Skeleton,
  useTheme,
  useMediaQuery
} from '@mui/material'; // v5.14+

// Internal imports
import EmailLayout from '../../layouts/EmailLayout';
import EmailThread from '../../components/email/EmailThread';
import ContextPanel from '../../components/context/ContextPanel';
import { useEmail } from '../../hooks/useEmail';
import { useContext } from '../../hooks/useContext';
import { IEmailMessage } from '../../types/email.types';
import { ROUTES } from '../../constants/routes.constants';

// Props interface
interface ThreadPageProps {
  className?: string;
}

// Main component
const ThreadPage: React.FC<ThreadPageProps> = React.memo(({ className }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const navigate = useNavigate();
  const { threadId } = useParams<{ threadId: string }>();

  // State for context panel visibility
  const [contextPanelOpen, setContextPanelOpen] = useState(!isMobile);

  // Email and context hooks
  const { 
    currentThread, 
    loading: emailLoading, 
    error: emailError,
    fetchThreadById 
  } = useEmail({
    autoRefresh: true,
    refreshInterval: 30000 // 30 seconds
  });

  const {
    fetchContextByEmail,
    loading: contextLoading,
    error: contextError
  } = useContext();

  // Fetch thread data on mount or threadId change
  useEffect(() => {
    if (threadId) {
      fetchThreadById(threadId);
    }
  }, [threadId, fetchThreadById]);

  // Handle reply action
  const handleReply = useCallback((email: IEmailMessage) => {
    navigate(ROUTES.EMAIL.COMPOSE, {
      state: {
        replyTo: email,
        threadId: email.threadId
      }
    });
  }, [navigate]);

  // Handle context panel toggle
  const handleContextPanelToggle = useCallback(() => {
    setContextPanelOpen(prev => !prev);
  }, []);

  // Handle context error
  const handleContextError = useCallback((error: Error) => {
    console.error('Context error:', error);
    // Additional error handling logic here
  }, []);

  // Loading state
  if (emailLoading) {
    return (
      <EmailLayout>
        <Container maxWidth="lg">
          <Box sx={{ p: 3 }}>
            <Skeleton variant="rectangular" height={200} sx={{ mb: 2 }} />
            <Skeleton variant="rectangular" height={100} sx={{ mb: 2 }} />
            <Skeleton variant="rectangular" height={100} />
          </Box>
        </Container>
      </EmailLayout>
    );
  }

  // Error state
  if (emailError) {
    return (
      <EmailLayout>
        <Container maxWidth="lg">
          <Box sx={{ p: 3 }}>
            <Alert 
              severity="error"
              role="alert"
              aria-live="assertive"
            >
              {emailError}
            </Alert>
          </Box>
        </Container>
      </EmailLayout>
    );
  }

  // No thread found state
  if (!currentThread) {
    return (
      <EmailLayout>
        <Container maxWidth="lg">
          <Box sx={{ p: 3 }}>
            <Alert 
              severity="info"
              role="alert"
            >
              Thread not found
            </Alert>
          </Box>
        </Container>
      </EmailLayout>
    );
  }

  return (
    <EmailLayout
      initialContextPanelOpen={contextPanelOpen}
      onLayoutChange={({ contextPanelOpen }) => setContextPanelOpen(contextPanelOpen)}
      className={className}
    >
      <Container 
        maxWidth="lg"
        sx={{
          display: 'flex',
          flexDirection: 'row',
          gap: 2,
          p: { xs: 1, sm: 2, md: 3 },
          position: 'relative',
          height: '100%'
        }}
      >
        {/* Main Thread View */}
        <Box
          sx={{
            flex: 1,
            overflow: 'auto',
            transition: theme.transitions.create('margin', {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.leavingScreen,
            }),
            ...(contextPanelOpen && {
              [theme.breakpoints.up('md')]: {
                marginRight: '320px',
              },
            }),
          }}
        >
          <EmailThread
            threadId={threadId}
            onReply={handleReply}
          />
        </Box>

        {/* Context Panel */}
        <ContextPanel
          emailId={currentThread.messages[0]?.messageId}
          open={contextPanelOpen}
          onClose={handleContextPanelToggle}
          onError={handleContextError}
          width={320}
        />

        {/* Loading Overlay */}
        {(contextLoading || emailLoading) && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              right: 0,
              padding: theme.spacing(2),
              zIndex: theme.zIndex.drawer + 1
            }}
          >
            <CircularProgress size={24} />
          </Box>
        )}
      </Container>
    </EmailLayout>
  );
});

ThreadPage.displayName = 'ThreadPage';

export default ThreadPage;