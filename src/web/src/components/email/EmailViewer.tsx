import React, { useCallback, useMemo } from 'react';
import { styled, useTheme } from '@mui/material/styles'; // v5.14+
import { 
  Card, 
  CardContent, 
  Typography, 
  Divider, 
  CircularProgress, 
  useMediaQuery,
  Box,
  Alert
} from '@mui/material'; // v5.14+
import DOMPurify from 'dompurify'; // v3.0+

import { IEmailMessage } from '../../types/email.types';
import { useEmail } from '../../hooks/useEmail';
import AttachmentPreview from './AttachmentPreview';
import { formatDate } from '../../utils/date.utils';

// Security constants for content sanitization
const ALLOWED_HTML_TAGS = [
  'p', 'br', 'div', 'span', 'a', 'ul', 'ol', 'li',
  'b', 'i', 'strong', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'img', 'table', 'tr', 'td', 'th', 'thead', 'tbody'
];

const ALLOWED_HTML_ATTRS = [
  'href', 'target', 'rel', 'style', 'class', 'id',
  'alt', 'title', 'src', 'width', 'height'
];

const SECURITY_CONFIG = {
  ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  ADD_TAGS: ['iframe'],
  ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling']
};

// Props interface
interface EmailViewerProps {
  messageId: string;
  onReply?: () => void;
  onForward?: () => void;
  className?: string;
  onError?: (error: Error) => void;
  highContrast?: boolean;
}

// Styled components
const StyledEmailViewer = styled(Card, {
  shouldForwardProp: (prop) => prop !== 'highContrast',
})<{ highContrast?: boolean }>(({ theme, highContrast }) => ({
  width: '100%',
  height: '100%',
  overflow: 'auto',
  backgroundColor: highContrast 
    ? theme.palette.background.default 
    : theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  boxShadow: theme.shadows[1],

  // High contrast mode support
  ...(highContrast && {
    border: `2px solid ${theme.palette.text.primary}`,
    '& *': {
      borderColor: theme.palette.text.primary,
    }
  }),

  // Focus styles for keyboard navigation
  '&:focus-visible': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: 2,
  },

  // Responsive styles
  [theme.breakpoints.down('sm')]: {
    borderRadius: 0,
    border: 'none',
  }
}));

const ContentContainer = styled(CardContent)(({ theme }) => ({
  padding: theme.spacing(3),
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(2),
  }
}));

// Content sanitization utility
const sanitizeContent = (content: string): string => {
  const config = {
    ALLOWED_TAGS: ALLOWED_HTML_TAGS,
    ALLOWED_ATTR: ALLOWED_HTML_ATTRS,
    ALLOW_DATA_ATTR: false,
    ALLOWED_URI_REGEXP: SECURITY_CONFIG.ALLOWED_URI_REGEXP,
    ADD_TAGS: SECURITY_CONFIG.ADD_TAGS,
    ADD_ATTR: SECURITY_CONFIG.ADD_ATTR,
    WHOLE_DOCUMENT: false,
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
    RETURN_TRUSTED_TYPE: true,
    SANITIZE_DOM: true
  };

  return DOMPurify.sanitize(content, config);
};

// Main component
export const EmailViewer = React.memo<EmailViewerProps>(({
  messageId,
  onReply,
  onForward,
  className,
  onError,
  highContrast = false
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  // Fetch email data
  const { currentEmail, loading, error } = useEmail({
    autoRefresh: false
  });

  // Memoized sanitized content
  const sanitizedContent = useMemo(() => {
    if (!currentEmail?.content) return '';
    return sanitizeContent(currentEmail.content);
  }, [currentEmail?.content]);

  // Error handling
  React.useEffect(() => {
    if (error) {
      onError?.(new Error(error));
    }
  }, [error, onError]);

  // Attachment handlers
  const handleAttachmentError = useCallback((error: Error) => {
    console.error('Attachment error:', error);
    onError?.(error);
  }, [onError]);

  if (loading) {
    return (
      <Box 
        display="flex" 
        justifyContent="center" 
        alignItems="center" 
        height="100%"
        role="progressbar"
        aria-label="Loading email content"
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error || !currentEmail) {
    return (
      <Alert 
        severity="error"
        role="alert"
        aria-live="assertive"
      >
        {error || 'Failed to load email content'}
      </Alert>
    );
  }

  return (
    <StyledEmailViewer 
      className={className}
      highContrast={highContrast}
      role="article"
      aria-label={`Email: ${currentEmail.subject}`}
      tabIndex={0}
    >
      <ContentContainer>
        {/* Email Header */}
        <Typography 
          variant="h6" 
          component="h1"
          gutterBottom
          sx={{ fontWeight: 'medium' }}
        >
          {currentEmail.subject}
        </Typography>

        <Box mb={2}>
          <Typography variant="body2" color="textSecondary">
            From: {currentEmail.fromAddress}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Date: {formatDate(currentEmail.receivedAt, {
              format: 'EMAIL_TIMESTAMP',
              includeTime: true
            })}
          </Typography>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Email Content */}
        <Box 
          mb={3}
          sx={{
            '& a': {
              color: theme.palette.primary.main,
              textDecoration: 'underline',
              '&:hover': {
                textDecoration: 'none'
              }
            }
          }}
        >
          <div 
            dangerouslySetInnerHTML={{ __html: sanitizedContent }}
            style={{ wordBreak: 'break-word' }}
          />
        </Box>

        {/* Attachments */}
        {currentEmail.attachments?.length > 0 && (
          <Box mt={3}>
            <Typography 
              variant="subtitle2" 
              gutterBottom
              role="heading"
              aria-level={2}
            >
              Attachments ({currentEmail.attachments.length})
            </Typography>
            <Box 
              display="flex" 
              flexDirection="column" 
              gap={1}
              role="list"
              aria-label="Email attachments"
            >
              {currentEmail.attachments.map((attachment) => (
                <AttachmentPreview
                  key={attachment.attachmentId}
                  attachment={attachment}
                  onError={handleAttachmentError}
                />
              ))}
            </Box>
          </Box>
        )}
      </ContentContainer>
    </StyledEmailViewer>
  );
});

EmailViewer.displayName = 'EmailViewer';

export default EmailViewer;