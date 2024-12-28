import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { styled, useTheme } from '@mui/material/styles';
import {
  AppBar,
  Toolbar,
  Typography,
  Badge,
  useMediaQuery,
  Box,
  IconButton as MuiIconButton,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import SettingsIcon from '@mui/icons-material/Settings';
import NotificationsIcon from '@mui/icons-material/Notifications';
import MenuIcon from '@mui/icons-material/Menu';
import LogoutIcon from '@mui/icons-material/Logout';
import { ROUTES } from '../../constants/routes.constants';
import { useAuth } from '../../hooks/useAuth';
import { CustomIconButton } from '../common/IconButton';

// Enhanced props interface with accessibility support
interface NavigationProps {
  onMenuClick?: () => void;
  className?: string;
  ariaLabel?: string;
}

// Styled components with responsive design and theme support
const StyledAppBar = styled(AppBar, {
  shouldForwardProp: (prop) => !['isMobile'].includes(prop as string),
})<{ isMobile: boolean }>(({ theme, isMobile }) => ({
  backgroundColor: theme.palette.background.paper,
  color: theme.palette.text.primary,
  boxShadow: theme.shadows[3],
  transition: theme.transitions.create(['margin', 'width'], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  zIndex: theme.zIndex.appBar,
  ...(isMobile && {
    width: '100%',
    marginLeft: 0,
  }),
}));

const StyledToolbar = styled(Toolbar)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: theme.spacing(0, 2),
  minHeight: 64,
  [theme.breakpoints.down('sm')]: {
    minHeight: 56,
  },
}));

const NavigationActions = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
}));

// Enhanced Navigation component with security and accessibility features
export const Navigation = React.memo<NavigationProps>(({
  onMenuClick,
  className,
  ariaLabel = 'Main navigation',
}) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { user, logout, checkPermission } = useAuth();
  const [notificationCount, setNotificationCount] = useState(0);

  // Security-enhanced navigation handler
  const handleSecureNavigation = useCallback(async (route: string, permission: string) => {
    try {
      if (!user) {
        navigate(ROUTES.AUTH.LOGIN);
        return;
      }

      if (await checkPermission(permission)) {
        navigate(route);
      } else {
        console.error('Access denied:', route);
        // Implement your unauthorized access handling
      }
    } catch (error) {
      console.error('Navigation error:', error);
    }
  }, [navigate, user, checkPermission]);

  // Secure logout handler
  const handleLogout = useCallback(async () => {
    try {
      await logout();
      navigate(ROUTES.AUTH.LOGIN);
    } catch (error) {
      console.error('Logout error:', error);
    }
  }, [logout, navigate]);

  // Keyboard navigation support
  const handleKeyPress = useCallback((event: React.KeyboardEvent, action: () => void) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      action();
    }
  }, []);

  // Update notification count (example implementation)
  useEffect(() => {
    // Implement your notification polling/websocket logic here
    const mockNotificationCount = 3;
    setNotificationCount(mockNotificationCount);
  }, []);

  return (
    <StyledAppBar 
      position="fixed" 
      isMobile={isMobile}
      className={className}
      role="navigation"
      aria-label={ariaLabel}
    >
      <StyledToolbar>
        {isMobile && (
          <CustomIconButton
            ariaLabel="Open menu"
            onClick={onMenuClick}
            tooltip="Menu"
            size="large"
          >
            <MenuIcon />
          </CustomIconButton>
        )}

        <Typography
          variant="h6"
          component="h1"
          sx={{ 
            flexGrow: 0,
            display: { xs: 'none', sm: 'block' },
            fontWeight: 500
          }}
        >
          Email Management
        </Typography>

        <NavigationActions>
          <CustomIconButton
            ariaLabel="Search emails"
            onClick={() => handleSecureNavigation(ROUTES.EMAIL.SEARCH, 'email:search')}
            tooltip="Search"
          >
            <SearchIcon />
          </CustomIconButton>

          <CustomIconButton
            ariaLabel="View notifications"
            onClick={() => handleSecureNavigation(ROUTES.SETTINGS.NOTIFICATIONS, 'notifications:view')}
            tooltip="Notifications"
          >
            <Badge badgeContent={notificationCount} color="error" max={99}>
              <NotificationsIcon />
            </Badge>
          </CustomIconButton>

          <CustomIconButton
            ariaLabel="Open settings"
            onClick={() => handleSecureNavigation(ROUTES.SETTINGS.ROOT, 'settings:view')}
            tooltip="Settings"
          >
            <SettingsIcon />
          </CustomIconButton>

          <CustomIconButton
            ariaLabel="Logout"
            onClick={handleLogout}
            tooltip="Logout"
            color="default"
          >
            <LogoutIcon />
          </CustomIconButton>
        </NavigationActions>
      </StyledToolbar>
    </StyledAppBar>
  );
});

Navigation.displayName = 'Navigation';

export default Navigation;