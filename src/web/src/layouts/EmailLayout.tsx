import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { Box, Container, useMediaQuery, useTheme } from '@mui/material'; // v5.14+
import { styled } from '@mui/material/styles'; // v5.14+

import AppBarComponent from '../components/layout/AppBar';
import Sidebar from '../components/layout/Sidebar';
import ContextPanel from '../components/context/ContextPanel';

// Constants for layout dimensions and animations
const SIDEBAR_WIDTH = 240;
const CONTEXT_PANEL_WIDTH = 320;
const ANIMATION_DURATION = 225;
const MIN_SWIPE_DISTANCE = 50;

// Layout state interface
interface LayoutState {
  sidebarOpen: boolean;
  contextPanelOpen: boolean;
  mainContentWidth: number;
}

// Layout action types
type LayoutAction =
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'TOGGLE_CONTEXT_PANEL' }
  | { type: 'SET_CONTENT_WIDTH'; payload: number }
  | { type: 'RESET_LAYOUT' };

// Props interface
export interface EmailLayoutProps {
  children: React.ReactNode;
  initialSidebarOpen?: boolean;
  initialContextPanelOpen?: boolean;
  onLayoutChange?: (layout: LayoutState) => void;
  className?: string;
}

// Styled components with Material Design 3.0 principles
const StyledLayout = styled(Box, {
  shouldForwardProp: (prop) => 
    !['isMobile', 'sidebarOpen', 'contextPanelOpen'].includes(prop as string),
})<{
  isMobile: boolean;
  sidebarOpen: boolean;
  contextPanelOpen: boolean;
}>(({ theme, isMobile, sidebarOpen, contextPanelOpen }) => ({
  display: 'flex',
  minHeight: '100vh',
  backgroundColor: theme.palette.background.default,
  transition: theme.transitions.create(['margin', 'width'], {
    easing: theme.transitions.easing.sharp,
    duration: ANIMATION_DURATION,
  }),
  ...(isMobile ? {
    flexDirection: 'column',
    marginLeft: 0,
  } : {
    marginLeft: sidebarOpen ? SIDEBAR_WIDTH : 0,
    marginRight: contextPanelOpen ? CONTEXT_PANEL_WIDTH : 0,
  }),
}));

const MainContent = styled(Container)(({ theme }) => ({
  flexGrow: 1,
  padding: theme.spacing(3),
  marginTop: 64, // AppBar height
  minHeight: 'calc(100vh - 64px)',
  overflow: 'auto',
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(2),
    marginTop: 56, // Mobile AppBar height
    minHeight: 'calc(100vh - 56px)',
  },
}));

// Layout reducer
const layoutReducer = (state: LayoutState, action: LayoutAction): LayoutState => {
  switch (action.type) {
    case 'TOGGLE_SIDEBAR':
      return { ...state, sidebarOpen: !state.sidebarOpen };
    case 'TOGGLE_CONTEXT_PANEL':
      return { ...state, contextPanelOpen: !state.contextPanelOpen };
    case 'SET_CONTENT_WIDTH':
      return { ...state, mainContentWidth: action.payload };
    case 'RESET_LAYOUT':
      return { ...state, sidebarOpen: false, contextPanelOpen: false };
    default:
      return state;
  }
};

// Main component
export const EmailLayout: React.FC<EmailLayoutProps> = React.memo(({
  children,
  initialSidebarOpen = true,
  initialContextPanelOpen = false,
  onLayoutChange,
  className
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const mainContentRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number>(0);

  // Initialize layout state
  const [layoutState, dispatch] = useReducer(layoutReducer, {
    sidebarOpen: !isMobile && initialSidebarOpen,
    contextPanelOpen: !isMobile && initialContextPanelOpen,
    mainContentWidth: 0,
  });

  // Handle layout changes
  useEffect(() => {
    onLayoutChange?.(layoutState);
  }, [layoutState, onLayoutChange]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (mainContentRef.current) {
        dispatch({
          type: 'SET_CONTENT_WIDTH',
          payload: mainContentRef.current.offsetWidth,
        });
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle mobile view
  useEffect(() => {
    if (isMobile) {
      dispatch({ type: 'RESET_LAYOUT' });
    }
  }, [isMobile]);

  // Touch gesture handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const touchEndX = e.changedTouches[0].clientX;
    const deltaX = touchEndX - touchStartX.current;

    if (Math.abs(deltaX) > MIN_SWIPE_DISTANCE) {
      if (deltaX > 0 && !layoutState.sidebarOpen) {
        dispatch({ type: 'TOGGLE_SIDEBAR' });
      } else if (deltaX < 0 && !layoutState.contextPanelOpen) {
        dispatch({ type: 'TOGGLE_CONTEXT_PANEL' });
      }
    }
  }, [layoutState.sidebarOpen, layoutState.contextPanelOpen]);

  return (
    <StyledLayout
      isMobile={isMobile}
      sidebarOpen={layoutState.sidebarOpen}
      contextPanelOpen={layoutState.contextPanelOpen}
      className={className}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      role="main"
      aria-label="Email management interface"
    >
      <AppBarComponent
        onMenuClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
        ariaLabel="Top navigation bar"
      />

      <Sidebar
        open={layoutState.sidebarOpen}
        onClose={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
        width={SIDEBAR_WIDTH}
      />

      <MainContent
        ref={mainContentRef}
        maxWidth={false}
        role="region"
        aria-label="Main content area"
      >
        {children}
      </MainContent>

      <ContextPanel
        emailId={null} // To be connected with email context
        open={layoutState.contextPanelOpen}
        width={CONTEXT_PANEL_WIDTH}
        onClose={() => dispatch({ type: 'TOGGLE_CONTEXT_PANEL' })}
      />
    </StyledLayout>
  );
});

EmailLayout.displayName = 'EmailLayout';

export default EmailLayout;