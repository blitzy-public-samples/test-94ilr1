/**
 * @fileoverview EmailListItem component for rendering individual email items
 * Implements Material Design 3.0 principles and WCAG 2.1 Level AA compliance
 * @version 1.0.0
 */

import React from 'react'; // v18.2+
import { 
  ListItem, 
  ListItemText, 
  ListItemIcon, 
  Typography 
} from '@mui/material'; // v5.14+
import { styled } from '@mui/material/styles'; // v5.14+
import { 
  AttachmentIcon,
  PriorityHighIcon,
  MailIcon
} from '@mui/icons-material'; // v5.14+

import { IEmailMessage, EmailPriority, EmailStatus } from '../../types/email.types';
import { CustomBadge } from '../common/Badge';
import { formatDate, DateFormat } from '../../utils/date.utils';

// Props interface with comprehensive type definitions
interface EmailListItemProps {
  /** Email message data */
  email: IEmailMessage;
  /** Click handler for email selection */
  onClick: (email: IEmailMessage) => void;
  /** Selected state for highlighting */
  selected?: boolean;
  /** Tab index for keyboard navigation */
  tabIndex?: number;
  /** Keyboard event handler */
  onKeyDown?: (event: React.KeyboardEvent) => void;
}

// Styled ListItem with Material Design 3.0 principles
const StyledListItem = styled(ListItem)(({ theme }) => ({
  cursor: 'pointer',
  padding: theme.spacing(2, 3),
  borderBottom: `1px solid ${theme.palette.divider}`,
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2),
  transition: theme.transitions.create(['background-color'], {
    duration: theme.transitions.duration.shortest,
  }),
  
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
  },
  
  '&.selected': {
    backgroundColor: theme.palette.action.selected,
  },
  
  // Enhanced focus styles for accessibility
  '&:focus-visible': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: '-2px',
  },
  
  // Unread email styling
  '&[data-unread="true"]': {
    '.MuiTypography-root': {
      fontWeight: theme.typography.fontWeightMedium,
    },
    backgroundColor: theme.palette.background.paper,
  },
  
  // High contrast mode support
  '@media (forced-colors: active)': {
    borderBottom: '1px solid CanvasText',
    '&:focus-visible': {
      outline: '2px solid Highlight',
    },
  },
  
  // Reduced motion preference support
  '@media (prefers-reduced-motion: reduce)': {
    transition: 'none',
  },
}));

/**
 * EmailListItem component for rendering individual email items with accessibility support
 * @param props Component props
 * @returns Rendered email list item
 */
export const EmailListItem = React.memo<EmailListItemProps>(({
  email,
  onClick,
  selected = false,
  tabIndex = 0,
  onKeyDown,
}) => {
  // Format received date with localization support
  const formattedDate = React.useMemo(() => formatDate(email.receivedAt, {
    format: DateFormat.RELATIVE_TIME,
    relative: true,
    useCache: true,
  }), [email.receivedAt]);

  // Priority badge configuration
  const getPriorityBadge = React.useCallback(() => {
    if (email.priority === EmailPriority.HIGH || email.priority === EmailPriority.URGENT) {
      return (
        <CustomBadge
          color="error"
          variant="dot"
          tooltipText={email.priority === EmailPriority.URGENT ? 'Urgent' : 'High Priority'}
          aria-label={`Priority: ${email.priority === EmailPriority.URGENT ? 'Urgent' : 'High'}`}
        >
          <PriorityHighIcon color="error" fontSize="small" />
        </CustomBadge>
      );
    }
    return null;
  }, [email.priority]);

  // Handle keyboard interaction for accessibility
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick(email);
    }
    onKeyDown?.(event);
  };

  // Generate descriptive ARIA label
  const getAriaLabel = React.useMemo(() => {
    const status = email.status === EmailStatus.UNREAD ? 'unread' : 'read';
    const priority = email.priority === EmailPriority.HIGH ? 'high priority' : 
                    email.priority === EmailPriority.URGENT ? 'urgent' : '';
    const attachments = email.attachments.length ? `${email.attachments.length} attachments` : '';
    
    return `${status} email from ${email.fromAddress}, subject: ${email.subject}, ${formattedDate}${priority ? `, ${priority}` : ''}${attachments ? `, ${attachments}` : ''}`;
  }, [email, formattedDate]);

  return (
    <StyledListItem
      onClick={() => onClick(email)}
      onKeyDown={handleKeyDown}
      selected={selected}
      tabIndex={tabIndex}
      data-unread={email.status === EmailStatus.UNREAD}
      aria-label={getAriaLabel}
      role="listitem"
      className={selected ? 'selected' : ''}
    >
      <ListItemIcon sx={{ minWidth: 'auto' }}>
        <MailIcon 
          color={email.status === EmailStatus.UNREAD ? 'primary' : 'action'}
          fontSize="small"
        />
      </ListItemIcon>

      <ListItemText
        primary={
          <Typography
            variant="subtitle1"
            component="span"
            noWrap
            sx={{ display: 'block' }}
          >
            {email.fromAddress}
          </Typography>
        }
        secondary={
          <Typography
            variant="body2"
            color="text.secondary"
            noWrap
            component="span"
          >
            {email.subject}
          </Typography>
        }
        sx={{ flex: 1, minWidth: 0 }}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {getPriorityBadge()}
        
        {email.attachments.length > 0 && (
          <CustomBadge
            content={email.attachments.length}
            color="default"
            tooltipText={`${email.attachments.length} attachments`}
            aria-label={`${email.attachments.length} attachments`}
          >
            <AttachmentIcon fontSize="small" />
          </CustomBadge>
        )}

        <Typography
          variant="caption"
          color="text.secondary"
          component="span"
          sx={{ whiteSpace: 'nowrap' }}
          aria-label={`Received ${formattedDate}`}
        >
          {formattedDate}
        </Typography>
      </div>
    </StyledListItem>
  );
});

// Display name for debugging
EmailListItem.displayName = 'EmailListItem';

export type { EmailListItemProps };