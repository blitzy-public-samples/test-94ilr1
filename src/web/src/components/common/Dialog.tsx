import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material'; // v5.14+
import { styled } from '@mui/material/styles'; // v5.14+
import { Close } from '@mui/icons-material'; // v5.14+
import CustomButton from './Button';
import CustomIconButton from './IconButton';

/**
 * Props interface for the Dialog component with comprehensive customization options
 */
interface DialogProps {
  /** Controls dialog visibility state */
  open: boolean;
  /** Dialog title text with optional ReactNode support */
  title?: React.ReactNode;
  /** Dialog size variant */
  size?: 'small' | 'medium' | 'large' | 'fullscreen';
  /** Close handler with reason */
  onClose: (event: {}, reason: 'backdropClick' | 'escapeKeyDown' | 'closeButton') => void;
  /** Custom action buttons for dialog footer */
  actions?: React.ReactNode;
  /** Prevents closing on backdrop click */
  disableBackdropClick?: boolean;
  /** Prevents closing on ESC key */
  disableEscapeKeyDown?: boolean;
  /** Makes dialog take full width of container */
  fullWidth?: boolean;
  /** Maximum width constraint */
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Dialog content */
  children: React.ReactNode;
  /** Additional CSS class name */
  className?: string;
  /** Custom transition props */
  TransitionProps?: React.ComponentProps<typeof Dialog>['TransitionProps'];
  /** Keeps dialog mounted when closed */
  keepMounted?: boolean;
  /** Scroll behavior configuration */
  scroll?: 'body' | 'paper';
}

/**
 * Enhanced styled dialog component with responsive sizing and animations
 */
const StyledDialog = styled(Dialog, {
  shouldForwardProp: (prop) => !['size'].includes(prop as string),
})<{ size?: DialogProps['size'] }>(({ theme, size, maxWidth }) => ({
  '& .MuiDialog-paper': {
    margin: theme.spacing(2),
    borderRadius: theme.shape.borderRadius * 2,
    ...(size === 'small' && {
      maxWidth: theme.breakpoints.values.sm / 2,
    }),
    ...(size === 'medium' && {
      maxWidth: theme.breakpoints.values.sm,
    }),
    ...(size === 'large' && {
      maxWidth: theme.breakpoints.values.md,
    }),
    ...(size === 'fullscreen' && {
      margin: 0,
      maxWidth: '100%',
      height: '100%',
      borderRadius: 0,
    }),
    // Responsive adjustments
    [theme.breakpoints.down('sm')]: {
      margin: size === 'fullscreen' ? 0 : theme.spacing(1),
      width: size === 'fullscreen' ? '100%' : 'calc(100% - 32px)',
      maxHeight: size === 'fullscreen' ? '100%' : 'calc(100% - 32px)',
    },
  },
  // High contrast mode support
  '@media (forced-colors: active)': {
    '& .MuiDialog-paper': {
      border: '2px solid ButtonText',
    },
  },
}));

/**
 * Styled dialog title with close button and enhanced typography
 */
const StyledDialogTitle = styled(DialogTitle)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: theme.spacing(2, 3),
  '& .MuiTypography-root': {
    ...theme.typography.h6,
    fontWeight: theme.typography.fontWeightMedium,
  },
}));

/**
 * Main dialog component with comprehensive features and accessibility support
 * Implements Material Design 3.0 principles and WCAG 2.1 Level AA compliance
 */
const CustomDialog = React.memo<DialogProps>(({
  open,
  title,
  size = 'medium',
  onClose,
  actions,
  disableBackdropClick = false,
  disableEscapeKeyDown = false,
  fullWidth = false,
  maxWidth = 'sm',
  children,
  className,
  TransitionProps,
  keepMounted = false,
  scroll = 'paper',
  ...props
}) => {
  // Handle dialog close events
  const handleClose = React.useCallback((reason: 'backdropClick' | 'escapeKeyDown' | 'closeButton') => {
    if ((reason === 'backdropClick' && disableBackdropClick) ||
        (reason === 'escapeKeyDown' && disableEscapeKeyDown)) {
      return;
    }
    onClose({}, reason);
  }, [onClose, disableBackdropClick, disableEscapeKeyDown]);

  // Manage focus trap and keyboard navigation
  const dialogRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (open && dialogRef.current) {
      dialogRef.current.focus();
    }
  }, [open]);

  return (
    <StyledDialog
      open={open}
      size={size}
      maxWidth={maxWidth}
      fullWidth={fullWidth}
      onClose={(_, reason) => handleClose(reason)}
      aria-labelledby="dialog-title"
      aria-describedby="dialog-description"
      ref={dialogRef}
      keepMounted={keepMounted}
      scroll={scroll}
      TransitionProps={{
        onEntering: (node) => {
          // Auto-focus first interactive element
          const focusable = node.querySelector(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          ) as HTMLElement;
          focusable?.focus();
        },
        ...TransitionProps,
      }}
      className={className}
      {...props}
    >
      {title && (
        <StyledDialogTitle id="dialog-title">
          {title}
          <CustomIconButton
            size="small"
            ariaLabel="Close dialog"
            tooltip="Close"
            onClick={() => handleClose('closeButton')}
          >
            <Close />
          </CustomIconButton>
        </StyledDialogTitle>
      )}

      <DialogContent
        id="dialog-description"
        dividers={!!title}
        sx={{
          padding: (theme) => theme.spacing(3),
          overflowX: 'hidden',
        }}
      >
        {children}
      </DialogContent>

      {actions && (
        <DialogActions
          sx={{
            padding: (theme) => theme.spacing(2, 3),
            gap: (theme) => theme.spacing(1),
          }}
        >
          {actions}
        </DialogActions>
      )}
    </StyledDialog>
  );
});

// Display name for debugging
CustomDialog.displayName = 'CustomDialog';

export type { DialogProps };
export default CustomDialog;