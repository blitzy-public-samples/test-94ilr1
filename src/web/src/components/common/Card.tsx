// @mui/material v5.14+
import React from 'react';
import { Card as MuiCard, CardContent, CardActions } from '@mui/material';
import { styled, useTheme } from '@mui/material/styles';
import { lightTheme, darkTheme } from '../../styles/theme';

// Interface for Card component props with comprehensive accessibility support
interface CardProps {
  children: React.ReactNode;
  variant?: 'elevation' | 'outlined';
  elevation?: number;
  className?: string;
  onClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
  actions?: React.ReactNode;
  noPadding?: boolean;
  ariaLabel?: string;
  role?: string;
  tabIndex?: number;
  interactive?: boolean;
  focusable?: boolean;
}

// Enhanced styled wrapper for MUI Card with comprehensive theme integration
const StyledCard = styled(MuiCard, {
  shouldForwardProp: (prop) => 
    !['interactive', 'focusable', 'noPadding'].includes(prop as string),
})<CardProps>(({ theme, interactive, focusable, noPadding }) => ({
  position: 'relative',
  backgroundColor: theme.palette.background.paper,
  borderRadius: {
    xs: theme.spacing(1),
    sm: theme.spacing(2),
  },
  transition: theme.transitions.create([
    'transform',
    'box-shadow',
    'border-color'
  ], {
    duration: theme.transitions.duration.shorter,
  }),

  // Interactive states
  ...(interactive && {
    cursor: 'pointer',
    '&:hover': {
      transform: 'translateY(-2px)',
      boxShadow: theme.shadows[4],
    },
    '&:active': {
      transform: 'translateY(0)',
    },
  }),

  // Focus management
  ...(focusable && {
    '&:focus-visible': {
      outline: `2px solid ${theme.palette.primary.main}`,
      outlineOffset: '2px',
    },
  }),

  // Content padding
  ...(!noPadding && {
    '& .MuiCardContent-root': {
      padding: {
        xs: theme.spacing(2),
        sm: theme.spacing(3),
      },
    },
    '& .MuiCardActions-root': {
      padding: theme.spacing(2),
      justifyContent: 'flex-end',
    },
  }),

  // High contrast mode support
  '@media (forced-colors: active)': {
    borderColor: 'CanvasText',
    '&:focus-visible': {
      outline: '3px solid CanvasText',
    },
  },

  // Touch target size for mobile
  '@media (pointer: coarse)': {
    '& .MuiCardActions-root button': {
      minHeight: '44px',
      minWidth: '44px',
    },
  },
}));

// Enhanced Material Design 3.0 card component with accessibility features
const CustomCard = React.memo<CardProps>(({
  children,
  variant = 'elevation',
  elevation = 1,
  className,
  onClick,
  actions,
  noPadding = false,
  ariaLabel,
  role = 'article',
  tabIndex = 0,
  interactive = false,
  focusable = true,
  ...props
}) => {
  const theme = useTheme();

  // Keyboard event handler for interactive cards
  const handleKeyDown = React.useCallback((event: React.KeyboardEvent) => {
    if (interactive && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      onClick?.(event as unknown as React.MouseEvent<HTMLDivElement>);
    }
  }, [interactive, onClick]);

  return (
    <StyledCard
      variant={variant}
      elevation={elevation}
      className={className}
      onClick={interactive ? onClick : undefined}
      onKeyDown={handleKeyDown}
      aria-label={ariaLabel}
      role={role}
      tabIndex={focusable ? tabIndex : -1}
      interactive={interactive}
      focusable={focusable}
      noPadding={noPadding}
      {...props}
    >
      <CardContent>
        {children}
      </CardContent>
      
      {actions && (
        <CardActions disableSpacing>
          {actions}
        </CardActions>
      )}
    </StyledCard>
  );
});

// Display name for development tooling
CustomCard.displayName = 'Card';

// Default export of the enhanced card component
export default CustomCard;

// Type export for component usage
export type { CardProps };