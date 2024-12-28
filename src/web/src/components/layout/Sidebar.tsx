import React, { useCallback, useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Collapse,
  Divider,
  Badge,
  Typography,
} from '@mui/material'; // v5.14+
import { styled } from '@mui/material/styles'; // v5.14+
import {
  Inbox,
  Send,
  Drafts,
  Label,
  Folder,
  ExpandLess,
  ExpandMore,
  Star,
  Flag,
} from '@mui/icons-material'; // v5.14+

import { CustomDrawer, DrawerProps } from '../common/Drawer';
import { CustomIconButton } from '../common/IconButton';
import { ROUTES } from '../../constants/routes.constants';

// Constants
const DRAWER_WIDTH = 240;
const MOBILE_BREAKPOINT = 768;
const TRANSITION_DURATION = 225;
const MIN_TOUCH_TARGET = 48;

// Interfaces
export interface SidebarProps {
  open: boolean;
  onClose: () => void;
  width?: number;
  defaultCollapsed?: string[];
  onSectionToggle?: (sectionId: string, isCollapsed: boolean) => void;
}

interface NavigationItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  route: string;
  badge?: number;
  ariaLabel: string;
  sectionId: string;
  shortcutKey?: string;
}

// Styled Components
const StyledSidebar = styled(CustomDrawer)<DrawerProps>(({ theme, width }) => ({
  width: width || DRAWER_WIDTH,
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: TRANSITION_DURATION,
  }),
  '& .MuiDrawer-paper': {
    backgroundColor: theme.palette.background.paper,
    borderRight: `1px solid ${theme.palette.divider}`,
    overflowX: 'hidden',
    touchAction: 'none',
    width: width || DRAWER_WIDTH,
    [theme.breakpoints.down('sm')]: {
      width: '100%',
    },
  },
}));

const NavigationList = styled(List)(({ theme }) => ({
  padding: theme.spacing(1),
  width: '100%',
  '& .MuiListItem-root': {
    borderRadius: theme.shape.borderRadius,
    margin: theme.spacing(0.5, 0),
    minHeight: MIN_TOUCH_TARGET,
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
    '&.Mui-selected': {
      backgroundColor: theme.palette.action.selected,
      '&:hover': {
        backgroundColor: theme.palette.action.selected,
      },
    },
  },
  '@media (max-width: 768px)': {
    '& .MuiListItem-root': {
      minHeight: MIN_TOUCH_TARGET,
    },
  },
}));

// Custom Hook for Navigation Items
const useNavigationItems = (): NavigationItem[] => {
  return useMemo(() => [
    {
      id: 'inbox',
      label: 'Inbox',
      icon: <Inbox />,
      route: ROUTES.EMAIL.INBOX,
      badge: 0,
      ariaLabel: 'Navigate to inbox',
      sectionId: 'mail',
      shortcutKey: 'i',
    },
    {
      id: 'sent',
      label: 'Sent',
      icon: <Send />,
      route: ROUTES.EMAIL.SENT,
      ariaLabel: 'Navigate to sent emails',
      sectionId: 'mail',
      shortcutKey: 's',
    },
    {
      id: 'drafts',
      label: 'Drafts',
      icon: <Drafts />,
      route: ROUTES.EMAIL.DRAFTS,
      badge: 0,
      ariaLabel: 'Navigate to drafts',
      sectionId: 'mail',
      shortcutKey: 'd',
    },
    {
      id: 'starred',
      label: 'Starred',
      icon: <Star />,
      route: ROUTES.EMAIL.ROOT + '/starred',
      ariaLabel: 'Navigate to starred emails',
      sectionId: 'labels',
      shortcutKey: '*',
    },
    {
      id: 'flagged',
      label: 'Flagged',
      icon: <Flag />,
      route: ROUTES.EMAIL.ROOT + '/flagged',
      ariaLabel: 'Navigate to flagged emails',
      sectionId: 'labels',
      shortcutKey: 'f',
    },
  ], []);
};

// Main Component
export const Sidebar = React.memo<SidebarProps>(({
  open,
  onClose,
  width = DRAWER_WIDTH,
  defaultCollapsed = [],
  onSectionToggle,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const navigationItems = useNavigationItems();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set(defaultCollapsed));

  // Handle section collapse toggle
  const handleSectionToggle = useCallback((sectionId: string) => {
    setCollapsed(prev => {
      const newCollapsed = new Set(prev);
      if (newCollapsed.has(sectionId)) {
        newCollapsed.delete(sectionId);
      } else {
        newCollapsed.add(sectionId);
      }
      onSectionToggle?.(sectionId, newCollapsed.has(sectionId));
      return newCollapsed;
    });
  }, [onSectionToggle]);

  // Handle navigation
  const handleNavigation = useCallback((route: string, ariaLabel: string) => {
    navigate(route);
    onClose();
  }, [navigate, onClose]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.altKey) {
        const item = navigationItems.find(
          item => item.shortcutKey === event.key.toLowerCase()
        );
        if (item) {
          event.preventDefault();
          handleNavigation(item.route, item.ariaLabel);
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [navigationItems, handleNavigation]);

  // Render navigation item
  const renderNavigationItem = (item: NavigationItem) => (
    <ListItem
      key={item.id}
      button
      selected={location.pathname === item.route}
      onClick={() => handleNavigation(item.route, item.ariaLabel)}
      aria-label={item.ariaLabel}
      role="menuitem"
    >
      <ListItemIcon>
        <CustomIconButton
          size="small"
          ariaLabel={item.ariaLabel}
          tooltip={`${item.label} (Alt + ${item.shortcutKey})`}
        >
          {item.badge ? (
            <Badge badgeContent={item.badge} color="primary">
              {item.icon}
            </Badge>
          ) : (
            item.icon
          )}
        </CustomIconButton>
      </ListItemIcon>
      <ListItemText primary={item.label} />
    </ListItem>
  );

  return (
    <StyledSidebar
      open={open}
      onClose={onClose}
      width={width}
      aria-label="Email navigation sidebar"
    >
      <NavigationList role="menu">
        {/* Mail Section */}
        <ListItem
          button
          onClick={() => handleSectionToggle('mail')}
          aria-expanded={!collapsed.has('mail')}
          aria-controls="mail-section"
        >
          <ListItemIcon>
            <Folder />
          </ListItemIcon>
          <ListItemText primary="Mail" />
          {collapsed.has('mail') ? <ExpandMore /> : <ExpandLess />}
        </ListItem>
        <Collapse in={!collapsed.has('mail')} timeout="auto" id="mail-section">
          <NavigationList>
            {navigationItems
              .filter(item => item.sectionId === 'mail')
              .map(renderNavigationItem)}
          </NavigationList>
        </Collapse>

        <Divider sx={{ my: 1 }} />

        {/* Labels Section */}
        <ListItem
          button
          onClick={() => handleSectionToggle('labels')}
          aria-expanded={!collapsed.has('labels')}
          aria-controls="labels-section"
        >
          <ListItemIcon>
            <Label />
          </ListItemIcon>
          <ListItemText primary="Labels" />
          {collapsed.has('labels') ? <ExpandMore /> : <ExpandLess />}
        </ListItem>
        <Collapse in={!collapsed.has('labels')} timeout="auto" id="labels-section">
          <NavigationList>
            {navigationItems
              .filter(item => item.sectionId === 'labels')
              .map(renderNavigationItem)}
          </NavigationList>
        </Collapse>
      </NavigationList>
    </StyledSidebar>
  );
});

Sidebar.displayName = 'Sidebar';

export default Sidebar;