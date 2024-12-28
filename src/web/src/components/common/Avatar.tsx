// @mui/material v5.14+
// @mui/material/styles v5.14+
// react v18.2+

import React, { useMemo } from 'react';
import { Avatar } from '@mui/material';
import { styled } from '@mui/material/styles';
import { User } from '../../types/auth.types';
import { getTheme } from '../../config/theme.config';

/**
 * Interface for Avatar component props with comprehensive type safety
 */
interface AvatarProps {
  user: User | null;
  size?: 'small' | 'medium' | 'large';
  variant?: 'circular' | 'rounded' | 'square';
  alt?: string;
  src?: string;
  className?: string;
  onError?: (event: React.SyntheticEvent<HTMLImageElement, Event>) => void;
  onClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
  ariaLabel?: string;
}

/**
 * Styled Avatar component with theme integration and responsive design
 */
const StyledAvatar = styled(Avatar)(({ theme, size = 'medium' }) => {
  const getSizeStyles = (avatarSize: string) => {
    const sizes = {
      small: {
        width: theme.spacing(4),
        height: theme.spacing(4),
        fontSize: '1rem',
        [theme.breakpoints.down('sm')]: {
          width: theme.spacing(3.5),
          height: theme.spacing(3.5),
          fontSize: '0.875rem',
        },
      },
      medium: {
        width: theme.spacing(5),
        height: theme.spacing(5),
        fontSize: '1.25rem',
        [theme.breakpoints.down('sm')]: {
          width: theme.spacing(4.5),
          height: theme.spacing(4.5),
          fontSize: '1.125rem',
        },
      },
      large: {
        width: theme.spacing(7),
        height: theme.spacing(7),
        fontSize: '1.5rem',
        [theme.breakpoints.down('sm')]: {
          width: theme.spacing(6),
          height: theme.spacing(6),
          fontSize: '1.375rem',
        },
      },
    };

    return sizes[avatarSize as keyof typeof sizes] || sizes.medium;
  };

  return {
    ...getSizeStyles(size),
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    transition: theme.transitions.create(['width', 'height', 'background-color'], {
      duration: theme.transitions.duration.shorter,
    }),
    '&:hover': {
      backgroundColor: theme.palette.primary.dark,
    },
    // Ensure minimum touch target size for accessibility
    minWidth: '44px',
    minHeight: '44px',
    // Focus visible styles for keyboard navigation
    '&:focus-visible': {
      outline: `2px solid ${theme.palette.primary.main}`,
      outlineOffset: '2px',
    },
  };
});

/**
 * Extracts initials from user name or email for fallback display
 * @param name - User's full name
 * @param email - User's email address
 * @returns Formatted initials string
 */
const getInitials = (name?: string, email?: string): string => {
  try {
    // Attempt to get initials from name
    if (name?.trim()) {
      const nameParts = name.trim().split(/\s+/);
      if (nameParts.length >= 2) {
        return `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase();
      }
      return nameParts[0].slice(0, 2).toUpperCase();
    }

    // Fallback to email
    if (email?.trim()) {
      return email.trim().slice(0, 2).toUpperCase();
    }

    return '?';
  } catch (error) {
    console.error('Error generating avatar initials:', error);
    return '?';
  }
};

/**
 * CustomAvatar component implementing Material Design 3.0 principles
 * with comprehensive accessibility features and theme integration
 */
const CustomAvatar: React.FC<AvatarProps> = ({
  user,
  size = 'medium',
  variant = 'circular',
  alt,
  src,
  className,
  onError,
  onClick,
  ariaLabel,
}) => {
  // Memoize initials calculation
  const initials = useMemo(() => {
    return getInitials(user?.name, user?.email);
  }, [user?.name, user?.email]);

  // Get current theme for styling
  const theme = getTheme(theme?.palette.mode);

  return (
    <StyledAvatar
      alt={alt || user?.name || 'User avatar'}
      src={src || user?.picture}
      size={size}
      variant={variant}
      className={className}
      onError={onError}
      onClick={onClick}
      aria-label={ariaLabel || `Avatar for ${user?.name || 'user'}`}
      role="img"
      theme={theme}
      // Accessibility attributes
      tabIndex={onClick ? 0 : -1}
      data-testid="custom-avatar"
    >
      {initials}
    </StyledAvatar>
  );
};

export default CustomAvatar;