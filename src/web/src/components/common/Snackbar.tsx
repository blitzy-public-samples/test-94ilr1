// React v18.2+
import React, { useCallback } from 'react';
// MUI v5.14+
import { Snackbar as MuiSnackbar, Alert, Slide, Fade } from '@mui/material';
import { styled } from '@mui/material/styles';
// Internal imports
import { useTheme } from '../../hooks/useTheme';

/**
 * Enhanced props interface for the Snackbar component
 */
export interface SnackbarProps {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  onClose: (id: string) => void;
  anchorOrigin?: {
    vertical: 'top' | 'bottom';
    horizontal: 'left' | 'right' | 'center';
  };
  role?: string;
  className?: string;
}

/**
 * StyledAlert component with theme-aware styling and RTL support
 */
const StyledAlert = styled(Alert)(({ theme }) => ({
  borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(1, 2),
  alignItems: 'center',
  boxShadow: theme.shadows[3],
  [theme.breakpoints.up('sm')]: {
    minWidth: '300px',
    maxWidth: '500px',
  },
  '& .MuiAlert-icon': {
    marginRight: theme.direction === 'rtl' ? 0 : theme.spacing(1),
    marginLeft: theme.direction === 'rtl' ? theme.spacing(1) : 0,
  },
  '& .MuiAlert-message': {
    padding: theme.spacing(0.5, 0),
    fontSize: theme.typography.body2.fontSize,
  },
  '& .MuiAlert-action': {
    paddingLeft: theme.direction === 'rtl' ? 0 : theme.spacing(2),
    paddingRight: theme.direction === 'rtl' ? theme.spacing(2) : 0,
    marginRight: theme.direction === 'rtl' ? 'auto' : 0,
    marginLeft: theme.direction === 'rtl' ? 0 : 'auto',
  },
}));

/**
 * Enhanced Snackbar component with accessibility, animations, and theme integration
 * Features:
 * - Material Design 3.0 styling
 * - WCAG 2.1 Level AA compliance
 * - RTL support
 * - Theme-aware styling
 * - Proper error handling
 * - Performance optimizations
 */
export const Snackbar = React.memo<SnackbarProps>(({
  id,
  message,
  type = 'info',
  duration = 6000,
  onClose,
  anchorOrigin = {
    vertical: 'bottom',
    horizontal: 'center',
  },
  role = 'alert',
  className,
}) => {
  // Access theme and direction
  const { theme } = useTheme();

  /**
   * Memoized close handler to prevent unnecessary re-renders
   */
  const handleClose = useCallback((event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }
    onClose(id);
  }, [id, onClose]);

  /**
   * Slide transition based on anchor position and theme direction
   */
  const getSlideDirection = () => {
    if (anchorOrigin.vertical === 'top') return 'down';
    if (anchorOrigin.vertical === 'bottom') return 'up';
    if (anchorOrigin.horizontal === 'left') return theme.direction === 'rtl' ? 'left' : 'right';
    if (anchorOrigin.horizontal === 'right') return theme.direction === 'rtl' ? 'right' : 'left';
    return 'up';
  };

  return (
    <MuiSnackbar
      open={true}
      autoHideDuration={duration}
      onClose={handleClose}
      anchorOrigin={anchorOrigin}
      TransitionComponent={Slide}
      TransitionProps={{ direction: getSlideDirection() }}
      className={className}
    >
      <Fade in={true}>
        <StyledAlert
          elevation={6}
          variant="filled"
          severity={type}
          onClose={handleClose}
          role={role}
          // Enhanced accessibility attributes
          aria-live="polite"
          aria-atomic="true"
          data-testid={`snackbar-${id}`}
        >
          {message}
        </StyledAlert>
      </Fade>
    </MuiSnackbar>
  );
});

// Display name for debugging
Snackbar.displayName = 'Snackbar';

// Default export
export default Snackbar;