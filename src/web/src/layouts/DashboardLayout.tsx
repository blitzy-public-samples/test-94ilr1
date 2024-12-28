import React, { useState, useCallback, useEffect } from 'react';
import { Box, Container, useMediaQuery, CircularProgress } from '@mui/material'; // v5.14+
import { styled } from '@mui/material/styles'; // v5.14+
import { useAnalytics } from '@segment/analytics-next'; // v1.51.0

// Internal imports
import AppBar from '../components/layout/AppBar';
import Sidebar from '../components/layout/Sidebar';
import useAuth from '../hooks/useAuth';
import useTheme from '../hooks/useTheme';

// Constants
const DRAWER_WIDTH = 240;
const MOBILE_BREAKPOINT = 768;
const SMALL_SCREEN_BREAKPOINT = 320;

// Props interface
export interface DashboardLayoutProps {
  children: React.ReactNode;
  pageTitle: string;
}

// Styled components with Material Design 3.0 principles
const DashboardContainer = styled(Container, {
  shouldForwardProp: (prop) => prop !== 'isSidebarOpen',
})<{ isSidebarOpen: boolean }>(({ theme, isSidebarOpen }) => ({
  display: 'flex',
  flexDirection: 'column',
  height: '100vh',
  padding: theme.spacing(3),
  marginTop: theme.spacing(8),
  marginLeft: isSidebarOpen ? DRAWER_WIDTH : 0,
  transition: theme.transitions.create(['margin'], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  maxWidth: '1440px',
  [theme.breakpoints.down('md')]: {
    marginLeft: 0,
    padding: theme.spacing(2),
  },
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(1),
  },
}));

const ContentWrapper = styled(Box)(({ theme }) => ({
  flexGrow: 1,
  backgroundColor: theme.palette.background.default,
  borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(2),
  overflow: 'auto',
  outline: 'none',
  position: 'relative',
  '&:focus-visible': {
    outline: `2px solid ${theme.palette.primary.main}`,
  },
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(1),
  },
}));

// Main component
const DashboardLayout = React.memo<DashboardLayoutProps>(({ children, pageTitle }) => {
  const { theme } = useTheme();
  const { isAuthenticated } = useAuth();
  const { track } = useAnalytics();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  // State
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Handle sidebar toggle
  const handleSidebarToggle = useCallback(() => {
    setSidebarOpen(prev => !prev);
  }, []);

  // Handle authentication state changes
  useEffect(() => {
    if (!isAuthenticated) {
      window.location.href = '/auth/login';
    }
  }, [isAuthenticated]);

  // Track page views
  useEffect(() => {
    if (pageTitle) {
      track('Page Viewed', {
        title: pageTitle,
        path: window.location.pathname,
        timestamp: new Date().toISOString(),
      });
    }
  }, [pageTitle, track]);

  // Handle responsive sidebar behavior
  useEffect(() => {
    if (isMobile && sidebarOpen) {
      setSidebarOpen(false);
    }
  }, [isMobile]);

  // Error boundary
  if (error) {
    return (
      <Box 
        role="alert" 
        aria-live="assertive"
        display="flex" 
        alignItems="center" 
        justifyContent="center" 
        height="100vh"
      >
        <p>An error occurred. Please try refreshing the page.</p>
      </Box>
    );
  }

  return (
    <Box 
      sx={{ display: 'flex', minHeight: '100vh' }}
      role="main"
      aria-label="Dashboard layout"
    >
      <AppBar 
        onMenuClick={handleSidebarToggle}
        ariaLabel={`${pageTitle} dashboard navigation`}
      />
      
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        width={DRAWER_WIDTH}
      />

      <DashboardContainer 
        isSidebarOpen={sidebarOpen && !isMobile}
        maxWidth={false}
      >
        <ContentWrapper
          component="main"
          tabIndex={-1}
          role="region"
          aria-label={`${pageTitle} content area`}
        >
          {isLoading ? (
            <Box 
              display="flex" 
              justifyContent="center" 
              alignItems="center" 
              minHeight="200px"
            >
              <CircularProgress 
                aria-label="Loading content"
                size={40}
              />
            </Box>
          ) : children}
        </ContentWrapper>
      </DashboardContainer>
    </Box>
  );
});

// Display name for debugging
DashboardLayout.displayName = 'DashboardLayout';

export default DashboardLayout;