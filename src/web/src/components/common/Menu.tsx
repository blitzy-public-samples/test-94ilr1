import React, { useCallback, useRef, useState, useEffect } from 'react';
import { Menu, MenuItem } from '@mui/material'; // v5.14+
import { styled } from '@mui/material/styles'; // v5.14+
import CustomIconButton, { IconButtonProps } from './IconButton';

// Enhanced interfaces for menu configuration
export interface MenuProps {
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  items: MenuItem[];
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'bottom-start' | 'bottom-end';
  maxHeight?: number;
  width?: number;
  ariaLabel: string;
  rtl?: boolean;
  virtualScroll?: boolean;
}

export interface MenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  divider?: boolean;
  subItems?: MenuItem[];
  ariaLabel?: string;
  shortcut?: string;
  tooltipText?: string;
}

// Styled components with Material Design 3.0 principles
const StyledMenu = styled(Menu, {
  shouldForwardProp: (prop) => !['maxHeight', 'width', 'rtl'].includes(prop as string),
})<{ maxHeight?: number; width?: number; rtl?: boolean }>(({ theme, maxHeight, width, rtl }) => ({
  '& .MuiPaper-root': {
    maxHeight: maxHeight || 'auto',
    width: width || 'auto',
    borderRadius: theme.shape.borderRadius,
    marginTop: theme.spacing(1),
    boxShadow: theme.shadows[3],
    backgroundColor: theme.palette.background.paper,
    direction: rtl ? 'rtl' : 'ltr',
    
    // Enhanced accessibility focus styles
    '& .MuiMenuItem-root:focus-visible': {
      outline: `2px solid ${theme.palette.primary.main}`,
      outlineOffset: -2,
    },
    
    // High contrast mode support
    '@media (forced-colors: active)': {
      border: '1px solid ButtonText',
      '& .MuiMenuItem-root:focus-visible': {
        outline: '2px solid ButtonText',
      },
    },
  },
}));

const StyledMenuItem = styled(MenuItem, {
  shouldForwardProp: (prop) => !['hasIcon', 'touchTarget', 'rtl'].includes(prop as string),
})<{ hasIcon?: boolean; touchTarget?: number; rtl?: boolean }>(({ theme, hasIcon, touchTarget, rtl }) => ({
  minHeight: touchTarget || 48, // WCAG touch target size
  padding: theme.spacing(1, 2),
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2),
  direction: rtl ? 'rtl' : 'ltr',
  
  // Icon alignment
  '& .MuiSvgIcon-root': {
    fontSize: 20,
    marginRight: hasIcon ? theme.spacing(2) : 0,
    marginLeft: hasIcon && rtl ? theme.spacing(2) : 0,
  },
  
  // Keyboard shortcut styling
  '& .menu-shortcut': {
    marginLeft: 'auto',
    color: theme.palette.text.secondary,
    fontSize: theme.typography.caption.fontSize,
  },
  
  // Enhanced states
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
  },
  '&.Mui-disabled': {
    opacity: 0.6,
  },
}));

// Helper function for rendering menu items with optimizations
const renderMenuItem = React.memo(({ 
  item, 
  index, 
  isRTL, 
  isMobile 
}: { 
  item: MenuItem; 
  index: number; 
  isRTL: boolean; 
  isMobile: boolean;
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const hasSubItems = item.subItems && item.subItems.length > 0;
  
  const handleItemClick = (event: React.MouseEvent<HTMLLIElement>) => {
    if (hasSubItems) {
      setAnchorEl(event.currentTarget);
    } else {
      item.onClick?.();
    }
  };

  return (
    <React.Fragment key={item.id}>
      <StyledMenuItem
        onClick={handleItemClick}
        disabled={item.disabled}
        divider={item.divider}
        hasIcon={Boolean(item.icon)}
        touchTarget={isMobile ? 56 : 48}
        rtl={isRTL}
        aria-label={item.ariaLabel || item.label}
        role="menuitem"
        aria-haspopup={hasSubItems}
        aria-expanded={Boolean(anchorEl)}
      >
        {item.icon}
        {item.label}
        {item.shortcut && (
          <span className="menu-shortcut" aria-hidden="true">
            {item.shortcut}
          </span>
        )}
      </StyledMenuItem>
      
      {hasSubItems && (
        <CustomMenu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={() => setAnchorEl(null)}
          items={item.subItems!}
          placement="right-start"
          ariaLabel={`${item.label} submenu`}
          rtl={isRTL}
        />
      )}
    </React.Fragment>
  );
});

renderMenuItem.displayName = 'renderMenuItem';

// Main menu component with accessibility and performance optimizations
export const CustomMenu = React.memo<MenuProps>(({
  anchorEl,
  open,
  onClose,
  items,
  placement = 'bottom-start',
  maxHeight = 300,
  width,
  ariaLabel,
  rtl = false,
  virtualScroll = false,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'Escape':
        onClose();
        break;
      case 'ArrowDown':
        event.preventDefault();
        const firstItem = menuRef.current?.querySelector('[role="menuitem"]');
        (firstItem as HTMLElement)?.focus();
        break;
    }
  }, [onClose]);

  // Update mobile state on resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <StyledMenu
      anchorEl={anchorEl}
      open={open}
      onClose={onClose}
      maxHeight={maxHeight}
      width={width}
      rtl={rtl}
      ref={menuRef}
      onKeyDown={handleKeyDown}
      anchorOrigin={{
        vertical: placement.includes('bottom') ? 'bottom' : 'top',
        horizontal: placement.includes('end') ? 'right' : 'left',
      }}
      transformOrigin={{
        vertical: placement.includes('bottom') ? 'top' : 'bottom',
        horizontal: placement.includes('end') ? 'right' : 'left',
      }}
      // Enhanced accessibility attributes
      role="menu"
      aria-label={ariaLabel}
      aria-orientation="vertical"
      // Performance optimizations
      keepMounted={false}
      disablePortal={false}
      transitionDuration={200}
    >
      {items.map((item, index) => (
        renderMenuItem({
          item,
          index,
          isRTL: rtl,
          isMobile,
        })
      ))}
    </StyledMenu>
  );
});

CustomMenu.displayName = 'CustomMenu';

export default CustomMenu;