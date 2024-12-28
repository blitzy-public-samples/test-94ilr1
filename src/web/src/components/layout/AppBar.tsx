import React, { useCallback, useEffect, useState } from 'react';
import { 
  AppBar, 
  Toolbar, 
  Typography, 
  Badge, 
  Tooltip,
  useTheme 
} from '@mui/material'; // v5.14+
import { styled } from '@mui/material/styles'; // v5.14+
import { 
  Menu as MenuIcon,
  Notifications as NotificationsIcon,
  Settings as SettingsIcon,
  AccountCircle as AccountCircleIcon
} from '@mui/icons-material'; // v5.14+
import { useTranslation } from 'react-i18next'; // latest

// Internal imports
import CustomIconButton from '../common/IconButton';
import CustomMenu from '../common/Menu';
import useAuth from '../../hooks/useAuth';
import useNotification from '../../hooks/useNotification';

// Interfaces
export interface AppBarProps {
  onMenuClick: () => void;
  className?: string;
  ariaLabel?: string;
}

// Styled components with Material Design 3.0 principles
const StyledAppBar = styled(AppBar)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  color: theme.palette.text.primary,
  boxShadow: theme.shadows[3],
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  zIndex: theme.zIndex.appBar,
  transition: theme.transitions.create(['width', 'margin'], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
}));

const StyledToolbar = styled(Toolbar)(({ theme }) => ({
  padding: theme.spacing(0, 2),
  minHeight: 64,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: theme.spacing(2),
}));

// Main component with security and accessibility enhancements
export const AppBarComponent = React.memo<AppBarProps>(({
  onMenuClick,
  className,
  ariaLabel = 'Application navigation bar'
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const { user, logout, validateSession } = useAuth();
  const { notifications, clearAllNotifications, markAsRead } = useNotification();

  // State for menu anchors
  const [profileAnchorEl, setProfileAnchorEl] = useState<null | HTMLElement>(null);
  const [notificationAnchorEl, setNotificationAnchorEl] = useState<null | HTMLElement>(null);
  const [settingsAnchorEl, setSettingsAnchorEl] = useState<null | HTMLElement>(null);

  // Validate session on mount
  useEffect(() => {
    validateSession();
  }, [validateSession]);

  // Handlers for menu interactions
  const handleProfileMenuOpen = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setProfileAnchorEl(event.currentTarget);
  }, []);

  const handleNotificationMenuOpen = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setNotificationAnchorEl(event.currentTarget);
    markAsRead();
  }, [markAsRead]);

  const handleSettingsMenuOpen = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setSettingsAnchorEl(event.currentTarget);
  }, []);

  const handleMenuClose = useCallback(() => {
    setProfileAnchorEl(null);
    setNotificationAnchorEl(null);
    setSettingsAnchorEl(null);
  }, []);

  // Menu items configuration
  const profileMenuItems = [
    {
      id: 'profile',
      label: t('Profile'),
      onClick: () => {/* Navigate to profile */},
      ariaLabel: t('View profile')
    },
    {
      id: 'logout',
      label: t('Logout'),
      onClick: async () => {
        await logout();
        handleMenuClose();
      },
      ariaLabel: t('Logout from application')
    }
  ];

  const settingsMenuItems = [
    {
      id: 'preferences',
      label: t('Preferences'),
      onClick: () => {/* Navigate to preferences */},
      ariaLabel: t('Application preferences')
    },
    {
      id: 'security',
      label: t('Security'),
      onClick: () => {/* Navigate to security settings */},
      ariaLabel: t('Security settings')
    }
  ];

  const unreadNotifications = notifications.filter(n => !n.read).length;

  return (
    <StyledAppBar 
      className={className}
      role="banner"
      aria-label={ariaLabel}
    >
      <StyledToolbar>
        <CustomIconButton
          onClick={onMenuClick}
          ariaLabel={t('Toggle navigation menu')}
          tooltip={t('Menu')}
        >
          <MenuIcon />
        </CustomIconButton>

        <Typography
          variant="h6"
          component="h1"
          sx={{ flexGrow: 1, ml: 2 }}
        >
          {t('AI Email Assistant')}
        </Typography>

        <CustomIconButton
          onClick={handleNotificationMenuOpen}
          ariaLabel={t('View notifications')}
          tooltip={t('Notifications')}
        >
          <Badge badgeContent={unreadNotifications} color="error">
            <NotificationsIcon />
          </Badge>
        </CustomIconButton>

        <CustomIconButton
          onClick={handleSettingsMenuOpen}
          ariaLabel={t('Open settings menu')}
          tooltip={t('Settings')}
        >
          <SettingsIcon />
        </CustomIconButton>

        <CustomIconButton
          onClick={handleProfileMenuOpen}
          ariaLabel={t('Open profile menu')}
          tooltip={user?.name || t('Profile')}
        >
          <AccountCircleIcon />
        </CustomIconButton>

        {/* Menus */}
        <CustomMenu
          anchorEl={profileAnchorEl}
          open={Boolean(profileAnchorEl)}
          onClose={handleMenuClose}
          items={profileMenuItems}
          ariaLabel={t('Profile menu')}
        />

        <CustomMenu
          anchorEl={settingsAnchorEl}
          open={Boolean(settingsAnchorEl)}
          onClose={handleMenuClose}
          items={settingsMenuItems}
          ariaLabel={t('Settings menu')}
        />

        <CustomMenu
          anchorEl={notificationAnchorEl}
          open={Boolean(notificationAnchorEl)}
          onClose={handleMenuClose}
          items={notifications.map(n => ({
            id: n.id,
            label: n.message,
            onClick: () => {/* Handle notification click */},
            ariaLabel: t('Notification: {{message}}', { message: n.message })
          }))}
          ariaLabel={t('Notifications menu')}
        />
      </StyledToolbar>
    </StyledAppBar>
  );
});

AppBarComponent.displayName = 'AppBarComponent';

export default AppBarComponent;