import React from 'react';
import { IconButton as MuiIconButton } from '@mui/material'; // v5.14+
import { styled, useTheme } from '@mui/material/styles'; // v5.14+
import { CustomTooltip } from './Tooltip';

// Types and Interfaces
export interface IconButtonProps {
  size?: 'small' | 'medium' | 'large';
  color?: 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success' | 'default';
  disabled?: boolean;
  loading?: boolean;
  tooltip?: string;
  tooltipPlacement?: 'top' | 'bottom' | 'left' | 'right';
  ariaLabel: string;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
  children: React.ReactNode;
  className?: string;
  tabIndex?: number;
}

// Styled Components
const StyledIconButton = styled(MuiIconButton, {
  shouldForwardProp: (prop) => 
    !['loading'].includes(prop as string),
})(({ theme, size, loading }) => ({
  // Base styles
  padding: theme.spacing(1),
  borderRadius: '50%',
  transition: theme.transitions.create(
    ['background-color', 'box-shadow', 'transform'],
    { duration: theme.transitions.duration.shorter }
  ),

  // Size variants with touch targets
  ...(size === 'small' && {
    padding: theme.spacing(0.75),
    [theme.breakpoints.up('sm')]: {
      minWidth: 32,
      minHeight: 32,
    },
    [theme.breakpoints.down('sm')]: {
      minWidth: 44, // Mobile touch target
      minHeight: 44,
    },
  }),
  ...(size === 'medium' && {
    padding: theme.spacing(1),
    [theme.breakpoints.up('sm')]: {
      minWidth: 40,
      minHeight: 40,
    },
    [theme.breakpoints.down('sm')]: {
      minWidth: 48, // Mobile touch target
      minHeight: 48,
    },
  }),
  ...(size === 'large' && {
    padding: theme.spacing(1.25),
    [theme.breakpoints.up('sm')]: {
      minWidth: 48,
      minHeight: 48,
    },
    [theme.breakpoints.down('sm')]: {
      minWidth: 52, // Mobile touch target
      minHeight: 52,
    },
  }),

  // Focus styles for accessibility
  '&:focus-visible': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: 2,
  },

  // Loading state styles
  ...(loading && {
    position: 'relative',
    pointerEvents: 'none',
    '&::after': {
      content: '""',
      position: 'absolute',
      top: '50%',
      left: '50%',
      width: '60%',
      height: '60%',
      borderRadius: '50%',
      border: `2px solid ${theme.palette.action.disabled}`,
      borderTopColor: theme.palette.primary.main,
      transform: 'translate(-50%, -50%)',
      animation: 'spin 1s linear infinite',
    },
    '@keyframes spin': {
      '0%': { transform: 'translate(-50%, -50%) rotate(0deg)' },
      '100%': { transform: 'translate(-50%, -50%) rotate(360deg)' },
    },
  }),

  // Disabled state styles
  '&.Mui-disabled': {
    opacity: 0.6,
    cursor: 'not-allowed',
  },

  // High contrast mode support
  '@media (forced-colors: active)': {
    '&:focus-visible': {
      outline: '2px solid ButtonText',
    },
  },
}));

// Main Component
export const CustomIconButton = React.memo<IconButtonProps>(({
  size = 'medium',
  color = 'default',
  disabled = false,
  loading = false,
  tooltip,
  tooltipPlacement = 'top',
  ariaLabel,
  onClick,
  onKeyDown,
  children,
  className,
  tabIndex = 0,
  ...props
}) => {
  const theme = useTheme();

  // Handle keyboard interactions
  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick?.(event as unknown as React.MouseEvent<HTMLButtonElement>);
    }
    onKeyDown?.(event);
  };

  // Base button element with accessibility attributes
  const buttonElement = (
    <StyledIconButton
      size={size}
      color={color}
      disabled={disabled || loading}
      loading={loading}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={className}
      aria-label={ariaLabel}
      aria-disabled={disabled || loading}
      aria-busy={loading}
      tabIndex={disabled ? -1 : tabIndex}
      {...props}
    >
      {children}
    </StyledIconButton>
  );

  // Wrap with tooltip if provided
  if (tooltip) {
    return (
      <CustomTooltip
        title={tooltip}
        placement={tooltipPlacement}
        arrow
        enterDelay={300}
        leaveDelay={0}
        aria-label={ariaLabel}
      >
        {buttonElement}
      </CustomTooltip>
    );
  }

  return buttonElement;
});

// Display name for debugging
CustomIconButton.displayName = 'CustomIconButton';

export default CustomIconButton;