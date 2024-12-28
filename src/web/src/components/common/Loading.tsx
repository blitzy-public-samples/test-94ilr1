import React from 'react';
import { CircularProgress, Box } from '@mui/material';
import { styled } from '@mui/material/styles';
import { lightTheme } from '../../styles/theme';

// Version comments for external dependencies
// @mui/material: v5.14+
// react: v18.2+

/**
 * Props interface for the Loading component with comprehensive customization options
 */
interface LoadingProps {
  /** Size of the loading indicator in pixels */
  size?: number;
  /** Color variant for the loading indicator */
  color?: 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success';
  /** Thickness of the circular progress */
  thickness?: number;
  /** Whether to show loading in an overlay */
  overlay?: boolean;
  /** Custom aria label for accessibility */
  ariaLabel?: string;
  /** Whether to disable tab navigation during loading */
  disableTabbing?: boolean;
}

/**
 * Styled component for loading overlay with accessibility and animation support
 */
const LoadingOverlay = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(255, 255, 255, 0.7)',
  zIndex: theme.zIndex.modal,
  backdropFilter: 'blur(2px)',
  transition: 'opacity 0.2s ease-in-out',
  opacity: 1,
  pointerEvents: 'all',
  
  // Dark mode support
  ...(theme.palette.mode === 'dark' && {
    backgroundColor: 'rgba(18, 18, 18, 0.7)',
  }),

  // Ensure proper stacking in various contexts
  '&[role="progressbar"]': {
    position: 'relative',
  },

  // Improve touch device interaction
  '@media (hover: none)': {
    cursor: 'none',
  },
}));

/**
 * Loading component that implements Material Design 3.0 principles with comprehensive
 * accessibility support and customization options.
 * 
 * @component
 * @example
 * // Basic usage
 * <Loading />
 * 
 * // With overlay and custom size
 * <Loading overlay size={60} color="primary" />
 */
const Loading: React.FC<LoadingProps> = React.memo(({
  size = 40,
  color = 'primary',
  thickness = 3.6,
  overlay = false,
  ariaLabel = 'Loading content',
  disableTabbing = true,
}) => {
  // Create ref for managing focus trap when overlay is active
  const progressRef = React.useRef<HTMLDivElement>(null);

  // Effect to manage focus and tab navigation
  React.useEffect(() => {
    if (overlay && disableTabbing) {
      const previousFocus = document.activeElement as HTMLElement;
      progressRef.current?.focus();

      return () => {
        previousFocus?.focus();
      };
    }
  }, [overlay, disableTabbing]);

  // Memoized progress indicator component
  const progressIndicator = React.useMemo(() => (
    <CircularProgress
      size={size}
      color={color}
      thickness={thickness}
      aria-label={ariaLabel}
      role="progressbar"
      aria-busy="true"
      ref={progressRef}
      tabIndex={overlay ? 0 : -1}
      sx={{
        // Ensure proper color contrast for accessibility
        color: (theme) => theme.palette[color].main,
        // Improve animation performance
        willChange: 'transform',
        // Support for RTL layouts
        transform: 'scale(1)',
        '[dir="rtl"] &': {
          transform: 'scale(-1, 1)',
        },
      }}
    />
  ), [size, color, thickness, ariaLabel, overlay]);

  // Render loading indicator with or without overlay
  if (overlay) {
    return (
      <LoadingOverlay
        role="presentation"
        aria-hidden="true"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
          }
        }}
      >
        {progressIndicator}
      </LoadingOverlay>
    );
  }

  return (
    <Box
      display="flex"
      alignItems="center"
      justifyContent="center"
      role="presentation"
    >
      {progressIndicator}
    </Box>
  );
});

// Display name for debugging and dev tools
Loading.displayName = 'Loading';

export default Loading;