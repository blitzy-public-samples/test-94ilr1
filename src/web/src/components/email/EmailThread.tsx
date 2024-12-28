import React, { useEffect, useCallback, useMemo } from 'react';
import { styled, useTheme } from '@mui/material/styles';
import { 
  Box, 
  Paper, 
  Typography, 
  Divider, 
  Avatar, 
  Tooltip,
  Skeleton 
} from '@mui/material';
import { useParams } from 'react-router-dom';

// Internal imports
import { IEmailThread, IEmailMessage } from '../../types/email.types';
import { useEmail } from '../../hooks/useEmail';
import EmailViewer from './EmailViewer';

// Styled components with Material Design 3.0 principles
const ThreadContainer = styled(Paper)(({ theme }) => ({
  width: '100%',
  height: '100%',
  overflow: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
  padding: theme.spacing(3),
  borderRadius: theme.shape.borderRadius,
  boxShadow: theme.shadows[1],
  backgroundColor: theme.palette.background.paper,
  transition: theme.transitions.create(['background-color', 'box-shadow']),

  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(2),
  },

  // High contrast mode support
  '@media (forced-colors: active)': {
    borderColor: 'ButtonText',
  },

  // Focus styles for keyboard navigation
  '&:focus-visible': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: 2,
  }
}));

const MessageContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
  padding: theme.spacing(2),
  borderRadius: theme.shape.borderRadius,
  backgroundColor: theme.palette.background.default,
  border: `1px solid ${theme.palette.divider}`,

  '&:hover': {
    backgroundColor: theme.palette.action.hover,
  }
}));

const ParticipantAvatar = styled(Avatar)(({ theme }) => ({
  width: 40,
  height: 40,
  marginRight: theme.spacing(2),
  border: `2px solid ${theme.palette.primary.main}`,
}));

// Props interface
interface EmailThreadProps {
  threadId?: string;
  onReply?: (email: IEmailMessage) => void;
  className?: string;
}

// Main component
export const EmailThread: React.FC<EmailThreadProps> = React.memo(({
  threadId: propThreadId,
  onReply,
  className
}) => {
  const theme = useTheme();
  const { threadId: urlThreadId } = useParams<{ threadId: string }>();
  const activeThreadId = propThreadId || urlThreadId;

  // Email hook with real-time updates
  const { 
    currentThread, 
    loading, 
    error,
    fetchThreadById,
    subscribeToThreadUpdates 
  } = useEmail();

  // Fetch thread data
  useEffect(() => {
    if (activeThreadId) {
      fetchThreadById(activeThreadId);
      const unsubscribe = subscribeToThreadUpdates(activeThreadId);
      return () => unsubscribe?.();
    }
  }, [activeThreadId, fetchThreadById, subscribeToThreadUpdates]);

  // Sort messages chronologically
  const sortedMessages = useMemo(() => {
    if (!currentThread?.messages) return [];
    return [...currentThread.messages].sort(
      (a, b) => new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime()
    );
  }, [currentThread?.messages]);

  // Handle reply action
  const handleReply = useCallback((message: IEmailMessage) => {
    onReply?.(message);
  }, [onReply]);

  // Loading state
  if (loading) {
    return (
      <ThreadContainer>
        {[1, 2, 3].map((i) => (
          <Box key={i} sx={{ display: 'flex', gap: 2, p: 2 }}>
            <Skeleton variant="circular" width={40} height={40} />
            <Box sx={{ flex: 1 }}>
              <Skeleton variant="text" width="30%" />
              <Skeleton variant="text" width="100%" />
              <Skeleton variant="text" width="60%" />
            </Box>
          </Box>
        ))}
      </ThreadContainer>
    );
  }

  // Error state
  if (error || !currentThread) {
    return (
      <ThreadContainer>
        <Typography color="error" role="alert">
          {error || 'Thread not found'}
        </Typography>
      </ThreadContainer>
    );
  }

  return (
    <ThreadContainer 
      className={className}
      role="region"
      aria-label="Email thread"
    >
      {/* Thread Header */}
      <Box sx={{ mb: 3 }}>
        <Typography 
          variant="h6" 
          component="h1"
          gutterBottom
        >
          {currentThread.subject}
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {currentThread.participants.map((participant) => (
            <Tooltip 
              key={participant}
              title={participant}
              arrow
            >
              <ParticipantAvatar>
                {participant[0].toUpperCase()}
              </ParticipantAvatar>
            </Tooltip>
          ))}
        </Box>
      </Box>

      <Divider />

      {/* Thread Messages */}
      <Box 
        sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
        role="list"
      >
        {sortedMessages.map((message, index) => (
          <MessageContainer 
            key={message.messageId}
            role="listitem"
            aria-label={`Email from ${message.fromAddress}`}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <ParticipantAvatar>
                {message.fromAddress[0].toUpperCase()}
              </ParticipantAvatar>
              <Box>
                <Typography variant="subtitle2">
                  {message.fromAddress}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {new Date(message.receivedAt).toLocaleString()}
                </Typography>
              </Box>
            </Box>

            <EmailViewer
              messageId={message.messageId}
              onReply={() => handleReply(message)}
              highContrast={theme.palette.mode === 'dark'}
            />

            {index < sortedMessages.length - 1 && (
              <Divider sx={{ my: 2 }} />
            )}
          </MessageContainer>
        ))}
      </Box>
    </ThreadContainer>
  );
});

EmailThread.displayName = 'EmailThread';

export default EmailThread;