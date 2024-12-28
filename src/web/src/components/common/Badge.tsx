import React from 'react'; // v18.2+
import { Badge, Tooltip } from '@mui/material'; // v5.14+
import { styled, useTheme } from '@mui/material/styles'; // v5.14+
import { lightTheme } from '../../styles/theme';

// Interface for Badge component props with comprehensive type definitions
interface BadgeProps {
  color?: 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success' | 'default';
  variant?: 'standard' | 'dot' | 'outlined';
  content?: string | number;
  size?: 'small' | 'medium' | 'large';
  overlap?: 'rectangular' | 'circular';
  invisible?: boolean;
  children?: React.ReactNode;
  emailStatus?: 'read' | 'unread' | 'flagged';
  priority?: 'high' | 'medium' | 'low';
  tooltipText?: string;
  disableAnimation?: boolean;
  className?: string;
  ariaLabel?: string;
}

// Styled Badge component with Material Design 3.0 styling
const StyledBadge = styled(Badge)(({ theme }) => ({
  '& .MuiBadge-badge': {
    fontSize: theme.typography.caption.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    minWidth: '20px',
    height: '20px',
    padding: '0 6px',
    transition: theme.transitions.create(['background-color', 'transform'], {
      duration: theme.transitions.duration.shorter,
    }),
    boxShadow: theme.shadows[1],

    // Size variants
    '&.small': {
      minWidth: '16px',
      height: '16px',
      fontSize: '12px',
      padding: '0 4px',
    },
    '&.large': {
      minWidth: '24px',
      height: '24px',
      fontSize: '14px',
      padding: '0 8px',
    },

    // Email status and priority styles
    '&.high-priority': {
      backgroundColor: theme.palette.error.main,
      transform: 'scale(1.1)',
    },
    '&.unread': {
      backgroundColor: theme.palette.primary.main,
      fontWeight: theme.typography.fontWeightBold,
    },
    '&.flagged': {
      backgroundColor: theme.palette.warning.main,
    },

    // Accessibility: Respect reduced motion preferences
    '@media (prefers-reduced-motion: reduce)': {
      transition: 'none',
    },

    // High contrast mode support
    '@media (forced-colors: active)': {
      border: '2px solid currentColor',
    },
  },
}));

// Memoized Badge component with email-specific features
const CustomBadge = React.memo<BadgeProps>(({
  color = 'default',
  variant = 'standard',
  content,
  size = 'medium',
  overlap = 'rectangular',
  invisible,
  children,
  emailStatus,
  priority,
  tooltipText,
  disableAnimation = false,
  className,
  ariaLabel,
}) => {
  const theme = useTheme();

  // Determine if badge should be invisible based on content
  const isInvisible = invisible || (!content && content !== 0);

  // Generate appropriate ARIA label
  const generateAriaLabel = () => {
    if (ariaLabel) return ariaLabel;
    
    const statusLabel = emailStatus ? `${emailStatus} email` : '';
    const priorityLabel = priority ? `${priority} priority` : '';
    const contentLabel = content ? `${content}` : '';
    
    return [contentLabel, statusLabel, priorityLabel]
      .filter(Boolean)
      .join(', ');
  };

  // Determine badge color based on email status and priority
  const getBadgeColor = () => {
    if (priority === 'high') return 'error';
    if (emailStatus === 'unread') return 'primary';
    if (emailStatus === 'flagged') return 'warning';
    return color;
  };

  // Generate class names based on props
  const badgeClasses = [
    className,
    size,
    emailStatus,
    priority && `${priority}-priority`,
  ].filter(Boolean).join(' ');

  const badge = (
    <StyledBadge
      badgeContent={content}
      color={getBadgeColor()}
      variant={variant}
      overlap={overlap}
      invisible={isInvisible}
      className={badgeClasses}
      sx={{
        '& .MuiBadge-badge': {
          transition: disableAnimation ? 'none' : undefined,
        },
      }}
      aria-label={generateAriaLabel()}
      role="status"
    >
      {children}
    </StyledBadge>
  );

  // Wrap with Tooltip if tooltipText is provided
  return tooltipText ? (
    <Tooltip 
      title={tooltipText}
      arrow
      placement="top"
      enterDelay={300}
      leaveDelay={200}
    >
      {badge}
    </Tooltip>
  ) : badge;
});

// Display name for debugging
CustomBadge.displayName = 'CustomBadge';

export default CustomBadge;

// Named exports for specific badge configurations
export const EmailBadge = React.memo<Omit<BadgeProps, 'variant' | 'overlap'>>((props) => (
  <CustomBadge {...props} variant="standard" overlap="rectangular" />
));

EmailBadge.displayName = 'EmailBadge';

export type { BadgeProps };