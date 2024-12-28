import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Tabs,
  Tab,
  Paper,
  Typography,
  useTheme,
  useMediaQuery,
  Alert,
  Breadcrumbs,
  Link,
} from '@mui/material'; // v5.14.0
import { styled } from '@mui/material/styles'; // v5.14.0
import {
  Settings as SettingsIcon,
  Email as EmailIcon,
  Notifications as NotificationsIcon,
  Security as SecurityIcon,
  Tune as TuneIcon,
  Code as CodeIcon,
} from '@mui/icons-material'; // v5.14.0

import Layout, { LayoutProps } from '../components/layout/Layout';
import useAuth from '../hooks/useAuth';
import useNotification from '../hooks/useNotification';
import { ROUTES } from '../constants/routes.constants';

// Constants for analytics tracking
const SETTINGS_ANALYTICS_CATEGORY = 'Settings';
const SETTINGS_PAGE_VIEW = 'Settings Page View';

// Interface for settings tabs configuration
interface SettingsTab {
  id: string;
  label: string;
  icon: React.ReactNode;
  path: string;
  ariaLabel: string;
  requiredRole?: string;
}

// Styled components with Material Design principles
const StyledSettingsContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(3),
  padding: theme.spacing(3),
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(2),
  },
}));

const StyledTabsContainer = styled(Paper)(({ theme }) => ({
  borderRadius: theme.shape.borderRadius,
  boxShadow: theme.shadows[1],
  backgroundColor: theme.palette.background.paper,
}));

const StyledTabs = styled(Tabs)(({ theme }) => ({
  borderBottom: `1px solid ${theme.palette.divider}`,
  '& .MuiTab-root': {
    minHeight: 48,
    minWidth: 90,
    [theme.breakpoints.up('sm')]: {
      minWidth: 120,
    },
  },
}));

// Settings tabs configuration
const SETTINGS_TABS: SettingsTab[] = [
  {
    id: 'account',
    label: 'Account',
    icon: <SettingsIcon />,
    path: ROUTES.SETTINGS.ACCOUNT,
    ariaLabel: 'Account settings tab',
  },
  {
    id: 'email',
    label: 'Email',
    icon: <EmailIcon />,
    path: ROUTES.SETTINGS.EMAIL,
    ariaLabel: 'Email settings tab',
  },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: <NotificationsIcon />,
    path: ROUTES.SETTINGS.NOTIFICATIONS,
    ariaLabel: 'Notification settings tab',
  },
  {
    id: 'security',
    label: 'Security',
    icon: <SecurityIcon />,
    path: ROUTES.SETTINGS.SECURITY,
    ariaLabel: 'Security settings tab',
  },
  {
    id: 'preferences',
    label: 'Preferences',
    icon: <TuneIcon />,
    path: ROUTES.SETTINGS.PREFERENCES,
    ariaLabel: 'User preferences tab',
  },
  {
    id: 'api',
    label: 'API',
    icon: <CodeIcon />,
    path: ROUTES.SETTINGS.API,
    ariaLabel: 'API settings tab',
    requiredRole: 'ADMIN',
  },
];

export interface SettingsLayoutProps extends Pick<LayoutProps, 'children'> {
  initialTab?: number;
  onTabChange?: (index: number) => void;
}

export const SettingsLayout: React.FC<SettingsLayoutProps> = React.memo(({
  children,
  initialTab = 0,
  onTabChange,
}) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { isAuthenticated, user } = useAuth();
  const { showNotification } = useNotification();

  // State for active tab and error handling
  const [activeTab, setActiveTab] = useState(initialTab);
  const [error, setError] = useState<Error | null>(null);

  // Get available tabs based on user role
  const availableTabs = SETTINGS_TABS.filter(tab => 
    !tab.requiredRole || (user?.roles || []).includes(tab.requiredRole)
  );

  // Effect to sync tab with URL
  useEffect(() => {
    const tabIndex = availableTabs.findIndex(tab => tab.path === location.pathname);
    if (tabIndex !== -1 && tabIndex !== activeTab) {
      setActiveTab(tabIndex);
    }
  }, [location.pathname, availableTabs, activeTab]);

  // Handle tab change with navigation and analytics
  const handleTabChange = useCallback((event: React.SyntheticEvent, newValue: number) => {
    try {
      const targetTab = availableTabs[newValue];
      if (targetTab) {
        setActiveTab(newValue);
        navigate(targetTab.path);
        onTabChange?.(newValue);

        // Track tab change in analytics
        window.analytics?.track('Settings Tab Change', {
          category: SETTINGS_ANALYTICS_CATEGORY,
          tabName: targetTab.label,
        });
      }
    } catch (error) {
      setError(error as Error);
      showNotification('error', 'Failed to change settings tab');
    }
  }, [availableTabs, navigate, onTabChange, showNotification]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.altKey) {
      const tabIndex = parseInt(event.key) - 1;
      if (tabIndex >= 0 && tabIndex < availableTabs.length) {
        handleTabChange(event, tabIndex);
      }
    }
  }, [availableTabs.length, handleTabChange]);

  // Security check for authenticated access
  if (!isAuthenticated) {
    navigate(ROUTES.AUTH.LOGIN, { replace: true });
    return null;
  }

  return (
    <Layout>
      <StyledSettingsContainer
        role="main"
        aria-label="Settings page"
        onKeyDown={handleKeyDown}
      >
        {/* Breadcrumb navigation */}
        <Breadcrumbs aria-label="Settings navigation">
          <Link
            color="inherit"
            href={ROUTES.DASHBOARD.ROOT}
            onClick={(e) => {
              e.preventDefault();
              navigate(ROUTES.DASHBOARD.ROOT);
            }}
          >
            Dashboard
          </Link>
          <Typography color="textPrimary">Settings</Typography>
        </Breadcrumbs>

        {/* Page title */}
        <Typography
          variant="h4"
          component="h1"
          gutterBottom
          sx={{ mb: 3 }}
        >
          Settings
        </Typography>

        {/* Error display */}
        {error && (
          <Alert 
            severity="error" 
            onClose={() => setError(null)}
            sx={{ mb: 2 }}
          >
            {error.message}
          </Alert>
        )}

        {/* Settings tabs */}
        <StyledTabsContainer>
          <StyledTabs
            value={activeTab}
            onChange={handleTabChange}
            variant={isMobile ? 'scrollable' : 'standard'}
            scrollButtons={isMobile ? 'auto' : false}
            aria-label="Settings navigation tabs"
          >
            {availableTabs.map((tab, index) => (
              <Tab
                key={tab.id}
                icon={tab.icon}
                label={!isMobile ? tab.label : undefined}
                aria-label={tab.ariaLabel}
                id={`settings-tab-${index}`}
                aria-controls={`settings-tabpanel-${index}`}
                sx={{
                  minHeight: 48,
                  minWidth: isMobile ? 48 : undefined,
                }}
              />
            ))}
          </StyledTabs>
        </StyledTabsContainer>

        {/* Settings content */}
        <Box
          role="tabpanel"
          id={`settings-tabpanel-${activeTab}`}
          aria-labelledby={`settings-tab-${activeTab}`}
          sx={{ mt: 2 }}
        >
          {children}
        </Box>
      </StyledSettingsContainer>
    </Layout>
  );
});

SettingsLayout.displayName = 'SettingsLayout';

export default SettingsLayout;
```

This implementation provides a comprehensive settings layout component that:

1. Implements Material Design principles with responsive behavior
2. Includes full accessibility support with ARIA labels and keyboard navigation
3. Implements role-based access control for settings tabs
4. Provides error handling and notifications
5. Includes analytics tracking
6. Supports mobile and desktop layouts
7. Implements proper navigation and routing
8. Includes breadcrumb navigation
9. Handles authentication requirements
10. Provides proper TypeScript typing and documentation

The component can be used in the application like this:

```typescript
const SettingsPage = () => {
  return (
    <SettingsLayout>
      {/* Settings content */}
    </SettingsLayout>
  );
};