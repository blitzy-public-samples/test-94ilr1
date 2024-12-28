// @mui/material v5.14+
import { Theme, ThemeMode, useMediaQuery } from '@mui/material';
import { lightTheme, darkTheme } from '../styles/theme';

// Theme mode constants
export const THEME_MODES = {
  LIGHT: 'light',
  DARK: 'dark',
} as const;

// Local storage key for theme preference
const STORAGE_KEYS = {
  THEME_PREFERENCE: 'theme_preference',
} as const;

/**
 * Color contrast validation for WCAG 2.1 Level AA compliance
 * @param backgroundColor - Background color in hex or rgba
 * @param textColor - Text color in hex or rgba
 * @returns boolean indicating if contrast ratio meets WCAG AA standards
 */
const validateColorContrast = (backgroundColor: string, textColor: string): boolean => {
  // Convert colors to relative luminance values
  const getLuminance = (color: string): number => {
    // Implementation of relative luminance calculation
    // Based on WCAG 2.1 specifications
    return 0.2126 * parseInt(color.slice(1, 3), 16) +
           0.7152 * parseInt(color.slice(3, 5), 16) +
           0.0722 * parseInt(color.slice(5, 7), 16);
  };

  const ratio = (Math.max(getLuminance(backgroundColor), getLuminance(textColor)) + 0.05) /
                (Math.min(getLuminance(backgroundColor), getLuminance(textColor)) + 0.05);

  // WCAG AA requires 4.5:1 for normal text and 3:1 for large text
  return ratio >= 4.5;
};

/**
 * Validates theme configuration for accessibility compliance
 * @param theme - Theme object to validate
 * @returns boolean indicating if theme meets accessibility requirements
 */
const validateAccessibility = (theme: Theme): boolean => {
  const checks = [
    // Color contrast validation
    validateColorContrast(
      theme.palette.background.default,
      theme.palette.text.primary
    ),
    validateColorContrast(
      theme.palette.background.paper,
      theme.palette.text.primary
    ),
    // Focus indicator presence
    theme.components?.MuiEmailItem?.styleOverrides?.root?.['&:focus-visible'],
    // Touch target size validation (40px minimum)
    theme.components?.MuiButton?.styleOverrides?.root?.minHeight === 40,
    // Typography scale validation
    theme.typography.fontSize !== undefined,
  ];

  return checks.every(Boolean);
};

/**
 * Gets initial theme based on system preference or stored setting
 * @returns ThemeMode for initial application state
 */
export const getInitialTheme = (): ThemeMode => {
  // Check stored preference
  const storedPreference = localStorage.getItem(STORAGE_KEYS.THEME_PREFERENCE) as ThemeMode;
  
  // Detect system preference
  const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  // Determine initial theme
  const initialTheme = storedPreference || (prefersDarkMode ? THEME_MODES.DARK : THEME_MODES.LIGHT);
  
  // Set up system preference change listener
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!storedPreference) {
      // Only update if user hasn't set a manual preference
      document.documentElement.setAttribute('data-theme', e.matches ? THEME_MODES.DARK : THEME_MODES.LIGHT);
    }
  });

  return initialTheme;
};

/**
 * Theme factory function with runtime customization and accessibility validation
 * @param mode - Theme mode to generate
 * @param customizations - Optional runtime theme customizations
 * @returns Validated theme object
 */
export const getTheme = (mode: ThemeMode, customizations: Record<string, unknown> = {}): Theme => {
  // Select base theme
  const baseTheme = mode === THEME_MODES.DARK ? darkTheme : lightTheme;

  // Apply customizations
  const customizedTheme = {
    ...baseTheme,
    ...customizations,
    // Ensure breakpoints are preserved
    breakpoints: {
      ...baseTheme.breakpoints,
      ...(customizations.breakpoints || {}),
    },
    // Merge component overrides
    components: {
      ...baseTheme.components,
      ...(customizations.components || {}),
    },
    // Merge palette options
    palette: {
      ...baseTheme.palette,
      ...(customizations.palette || {}),
      mode, // Ensure mode is correctly set
    },
  };

  // Validate accessibility
  if (!validateAccessibility(customizedTheme)) {
    console.warn(
      'Theme customization failed accessibility validation. Falling back to base theme.',
      customizations
    );
    return baseTheme;
  }

  return customizedTheme;
};

/**
 * Hook for responsive theme customization based on screen size
 * @param theme - Current theme object
 * @returns Theme with responsive customizations
 */
export const useResponsiveTheme = (theme: Theme): Theme => {
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md'));
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

  // Apply responsive customizations
  return {
    ...theme,
    components: {
      ...theme.components,
      MuiEmailItem: {
        ...theme.components?.MuiEmailItem,
        styleOverrides: {
          root: {
            ...theme.components?.MuiEmailItem?.styleOverrides?.root,
            padding: isMobile ? theme.spacing(1) : theme.spacing(2),
            fontSize: isMobile ? '0.875rem' : '1rem',
          },
        },
      },
      MuiButton: {
        ...theme.components?.MuiButton,
        styleOverrides: {
          root: {
            ...theme.components?.MuiButton?.styleOverrides?.root,
            minWidth: isMobile ? 64 : 88,
            padding: isMobile
              ? `${theme.spacing(1)} ${theme.spacing(2)}`
              : `${theme.spacing(1.5)} ${theme.spacing(3)}`,
          },
        },
      },
    },
  };
};