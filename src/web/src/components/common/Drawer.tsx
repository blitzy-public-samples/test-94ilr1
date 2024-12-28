// @mui/material v5.14+
import React, { useCallback, useEffect } from 'react';
import { Drawer, IconButton, useMediaQuery } from '@mui/material';
import { styled } from '@mui/material/styles';
import { ChevronLeft, ChevronRight } from '@mui/icons-material';
import { lightTheme, darkTheme } from '../../styles/theme';

// Constants for configuration
const DRAWER_WIDTH = 240;
const TRANSITION_DURATION = 225;
const MIN_TOUCH_TARGET = 48;
const FOCUS_VISIBLE_OUTLINE = '2px solid';

// Props interface with comprehensive accessibility support
export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  anchor?: 'left' | 'right' | 'top' | 'bottom';
  width?: number;
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
  transitionDuration?: number;
}

// Styled drawer component with theme integration
const StyledDrawer = styled(Drawer, {
  shouldForwardProp: (prop) => prop !== 'width' && prop !== 'transitionDuration',
})<{ width?: number; transitionDuration?: number }>(({ theme, width, transitionDuration }) => ({
  width: width || DRAWER_WIDTH,
  flexShrink: 0,
  whiteSpace: 'nowrap',
  '& .MuiDrawer-paper': {
    width: width || DRAWER_WIDTH,
    boxSizing: 'border-box',
    transition: theme.transitions.create(['width', 'margin'], {
      easing: theme.transitions.easing.sharp,
      duration: transitionDuration || TRANSITION_DURATION,
    }),
    overflowX: 'hidden',
    borderRight: `1px solid ${theme.palette.divider}`,
    [theme.breakpoints.down('sm')]: {
      width: '100%',
    },
    // Accessibility enhancements
    '&:focus-visible': {
      outline: `${FOCUS_VISIBLE_OUTLINE} ${theme.palette.primary.main}`,
      outlineOffset: 2,
    },
  },
}));

// Styled header section with responsive behavior
const DrawerHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: theme.spacing(0, 1),
  justifyContent: 'space-between',
  minHeight: 64,
  borderBottom: `1px solid ${theme.palette.divider}`,
  [theme.breakpoints.down('sm')]: {
    minHeight: 56,
  },
}));

// Close button with enhanced accessibility
const CloseButton = styled(IconButton)(({ theme }) => ({
  minWidth: MIN_TOUCH_TARGET,
  minHeight: MIN_TOUCH_TARGET,
  marginLeft: 'auto',
  '&:focus-visible': {
    outline: `${FOCUS_VISIBLE_OUTLINE} ${theme.palette.primary.main}`,
    outlineOffset: 2,
  },
}));

// Memoized drawer component for performance optimization
export const CustomDrawer = React.memo<DrawerProps>(({
  open,
  onClose,
  anchor = 'left',
  width = DRAWER_WIDTH,
  children,
  className,
  ariaLabel = 'Navigation drawer',
  transitionDuration = TRANSITION_DURATION,
}) => {
  // Responsive behavior hook
  const isMobile = useMediaQuery(lightTheme.breakpoints.down('sm'));
  
  // RTL support
  const isRTL = document.dir === 'rtl';
  const adjustedAnchor = isRTL ? (anchor === 'left' ? 'right' : 'left') : anchor;
  
  // Keyboard navigation handler
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  // Focus management
  useEffect(() => {
    if (open) {
      const firstFocusableElement = document.querySelector(
        '.MuiDrawer-paper [tabindex="0"]'
      ) as HTMLElement;
      firstFocusableElement?.focus();
    }
  }, [open]);

  // Touch gesture handling
  const handleTouchStart = useCallback((event: React.TouchEvent) => {
    const touch = event.touches[0];
    const drawer = event.currentTarget;
    const startX = touch.clientX;
    
    const handleTouchMove = (moveEvent: TouchEvent) => {
      const currentX = moveEvent.touches[0].clientX;
      const deltaX = currentX - startX;
      
      if (
        (adjustedAnchor === 'left' && deltaX < -50) ||
        (adjustedAnchor === 'right' && deltaX > 50)
      ) {
        onClose();
        drawer.removeEventListener('touchmove', handleTouchMove);
      }
    };
    
    drawer.addEventListener('touchmove', handleTouchMove);
  }, [adjustedAnchor, onClose]);

  return (
    <StyledDrawer
      variant={isMobile ? 'temporary' : 'persistent'}
      anchor={adjustedAnchor}
      open={open}
      onClose={onClose}
      width={width}
      transitionDuration={transitionDuration}
      className={className}
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
      onTouchStart={handleTouchStart}
      ModalProps={{
        keepMounted: true, // Better SEO
      }}
      PaperProps={{
        role: 'navigation',
        'aria-modal': isMobile ? 'true' : 'false',
        'aria-hidden': !open,
      }}
    >
      <DrawerHeader>
        <CloseButton
          onClick={onClose}
          aria-label="Close drawer"
          size="large"
          edge="end"
        >
          {adjustedAnchor === 'left' ? <ChevronLeft /> : <ChevronRight />}
        </CloseButton>
      </DrawerHeader>
      {children}
    </StyledDrawer>
  );
});

// Display name for debugging
CustomDrawer.displayName = 'CustomDrawer';

export default CustomDrawer;