import React, { useCallback, useState, useEffect } from 'react';
import { Box, Container, useMediaQuery, useTheme } from '@mui/material'; // v5.14.0
import { styled } from '@mui/material/styles'; // v5.14.0

// Internal imports
import AppBar from './AppBar';
import Sidebar from './Sidebar';
import useAuth from '../../hooks/useAuth';

// Constants for responsive design
const DRAWER_WIDTH = 240;
const MOBILE_BREAKPOINT = 768;
const DESKTOP_BREAKPOINT = 1024;
const LARGE_SCREEN_BREAKPOINT = 1440;

// Interface for Layout props
export interface LayoutProps {
  children: React.ReactNode;
}

// Styled components with Material Design 3.0 principles
const MainContent = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'isSidebarOpen',
})<{ isSidebarOpen: boolean }>(({ theme, isSidebarOpen }) => ({
  flexGrow: 1,
  padding: theme.spacing(3),
  marginTop: theme.mixins.toolbar.minHeight,
  marginLeft: isSidebarOpen ? DRAWER_WIDTH : 0,
  transition: theme.transitions.create(['margin', 'width'], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  minHeight: '100vh',
  position: 'relative',
  outline: 'none', // Will be handled by focus styles
  backgroundColor: theme.palette.background.default,
  
  // Responsive adjustments
  [theme.breakpoints.down('sm')]: {
    marginLeft: 0,
    padding: theme.spacing(2),
  },

  // RTL support
  [theme.direction === 'rtl' ? 'marginRight' : 'marginLeft']: isSidebarOpen ? DRAWER_WIDTH : 0,

  // Focus management
  '&:focus-visible': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: -2,
  },

  // High contrast mode support
  '@media (forced-colors: active)': {
    borderLeft: '1px solid ButtonText',
  },
}));

// Main Layout component with accessibility and responsive features
export const Layout = React.memo<LayoutProps>(({ children }) => {
  const theme = useTheme();
  const { isAuthenticated, user } = useAuth();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  // State for sidebar visibility
  const [isSidebarOpen, setIsSidebarOpen] = useState(!isMobile);
  
  // Track last focused element for focus restoration
  const lastFocusedElement = React.useRef<HTMLElement | null>(null);

  // Update sidebar state on screen resize
  useEffect(() => {
    setIsSidebarOpen(!isMobile);
  }, [isMobile]);

  // Handle sidebar toggle with keyboard support
  const handleSidebarToggle = useCallback(() => {
    setIsSidebarOpen(prev => !prev);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Escape' && isSidebarOpen && isMobile) {
      setIsSidebarOpen(false);
    }

    // Toggle sidebar with keyboard shortcut
    if (event.altKey && event.key === 'n') {
      handleSidebarToggle();
      event.preventDefault();
    }
  }, [handleSidebarToggle, isSidebarOpen, isMobile]);

  // Focus management
  useEffect(() => {
    if (!isSidebarOpen && lastFocusedElement.current) {
      lastFocusedElement.current.focus();
      lastFocusedElement.current = null;
    }
  }, [isSidebarOpen]);

  // Skip to main content functionality
  const handleSkipToContent = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      const mainContent = document.getElementById('main-content');
      mainContent?.focus();
    }
  }, []);

  if (!isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <Box 
      sx={{ display: 'flex', minHeight: '100vh' }}
      onKeyDown={handleKeyDown}
    >
      {/* Skip to main content link for accessibility */}
      <Box
        component="a"
        href="#main-content"
        sx={{
          position: 'absolute',
          top: -50,
          left: 16,
          zIndex: theme.zIndex.tooltip,
          '&:focus': {
            top: 16,
            backgroundColor: theme.palette.background.paper,
            padding: theme.spacing(1, 2),
            borderRadius: theme.shape.borderRadius,
            boxShadow: theme.shadows[4],
          },
        }}
        onKeyDown={handleSkipToContent}
      >
        Skip to main content
      </Box>

      {/* App Bar */}
      <AppBar 
        onMenuClick={handleSidebarToggle}
        ariaLabel="Main navigation"
      />

      {/* Sidebar Navigation */}
      <Sidebar
        open={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        width={DRAWER_WIDTH}
      />

      {/* Main Content Area */}
      <MainContent
        component="main"
        id="main-content"
        isSidebarOpen={isSidebarOpen}
        tabIndex={-1}
        role="main"
        aria-label="Main content"
      >
        <Container
          maxWidth={false}
          sx={{
            maxWidth: {
              sm: MOBILE_BREAKPOINT,
              md: DESKTOP_BREAKPOINT,
              lg: LARGE_SCREEN_BREAKPOINT,
            },
          }}
        >
          {children}
        </Container>
      </MainContent>
    </Box>
  );
});

Layout.displayName = 'Layout';

export default Layout;