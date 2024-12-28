// @mui/material/styles v5.14+
import { createTheme, Theme, PaletteOptions, ThemeOptions } from '@mui/material/styles';

// Extended theme options interface with email-specific customizations
interface CustomThemeOptions extends ThemeOptions {
  palette: PaletteOptions & {
    emailStates: {
      read: string;
      unread: string;
      flagged: string;
      archived: string;
    };
  };
}

// Shared breakpoints configuration based on mobile-first approach
const breakpoints = {
  values: {
    xs: 320,
    sm: 768,
    md: 1024,
    lg: 1440,
    xl: 1920,
  },
};

// Base spacing unit (4px grid system)
const spacing = 4;

// Shared typography configuration
const typography = {
  fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  emailTitle: {
    fontSize: '1rem',
    fontWeight: 500,
    lineHeight: 1.5,
    letterSpacing: '0.00938em',
  },
  emailBody: {
    fontSize: '0.875rem',
    fontWeight: 400,
    lineHeight: 1.43,
    letterSpacing: '0.01071em',
  },
  emailMeta: {
    fontSize: '0.75rem',
    fontWeight: 400,
    lineHeight: 1.66,
    letterSpacing: '0.03333em',
  },
  fontWeightLight: 300,
  fontWeightRegular: 400,
  fontWeightMedium: 500,
  fontWeightBold: 700,
};

// Shared component overrides for email-specific elements
const components = {
  MuiButton: {
    styleOverrides: {
      root: {
        borderRadius: 8,
        textTransform: 'none',
        minHeight: 40, // WCAG touch target size
      },
    },
  },
  MuiEmailItem: {
    styleOverrides: {
      root: {
        padding: spacing * 2,
        '&:focus-visible': {
          outline: '2px solid',
          outlineOffset: 2,
        },
      },
    },
  },
  MuiEmailList: {
    styleOverrides: {
      root: {
        '& > *:not(:last-child)': {
          borderBottom: '1px solid',
        },
      },
    },
  },
};

// Light theme configuration
const createLightTheme = (): Theme => {
  return createTheme({
    palette: {
      mode: 'light',
      primary: {
        main: '#1976d2', // WCAG AA compliant
        light: '#42a5f5',
        dark: '#1565c0',
        contrastText: '#ffffff',
      },
      secondary: {
        main: '#9c27b0',
        light: '#ba68c8',
        dark: '#7b1fa2',
        contrastText: '#ffffff',
      },
      background: {
        default: '#fafafa',
        paper: '#ffffff',
      },
      emailStates: {
        read: '#f5f5f5',
        unread: '#ffffff',
        flagged: '#fff3e0',
        archived: '#eeeeee',
      },
      text: {
        primary: 'rgba(0, 0, 0, 0.87)', // WCAG AA compliant
        secondary: 'rgba(0, 0, 0, 0.6)',
      },
    },
    typography,
    spacing,
    breakpoints,
    components: {
      ...components,
      MuiEmailItem: {
        ...components.MuiEmailItem,
        styleOverrides: {
          root: {
            ...components.MuiEmailItem.styleOverrides.root,
            borderColor: 'rgba(0, 0, 0, 0.12)',
          },
        },
      },
    },
  } as CustomThemeOptions);
};

// Dark theme configuration
const createDarkTheme = (): Theme => {
  return createTheme({
    palette: {
      mode: 'dark',
      primary: {
        main: '#90caf9', // High contrast for dark mode
        light: '#e3f2fd',
        dark: '#42a5f5',
        contrastText: '#000000',
      },
      secondary: {
        main: '#ce93d8',
        light: '#f3e5f5',
        dark: '#ab47bc',
        contrastText: '#000000',
      },
      background: {
        default: '#121212',
        paper: '#1e1e1e',
      },
      emailStates: {
        read: '#424242',
        unread: '#303030',
        flagged: '#4a4a4a',
        archived: '#383838',
      },
      text: {
        primary: '#ffffff', // High contrast for dark mode
        secondary: 'rgba(255, 255, 255, 0.7)',
      },
    },
    typography,
    spacing,
    breakpoints,
    components: {
      ...components,
      MuiEmailItem: {
        ...components.MuiEmailItem,
        styleOverrides: {
          root: {
            ...components.MuiEmailItem.styleOverrides.root,
            borderColor: 'rgba(255, 255, 255, 0.12)',
          },
        },
      },
    },
  } as CustomThemeOptions);
};

// Create theme instances
export const lightTheme = createLightTheme();
export const darkTheme = createDarkTheme();

// Type exports for theme customization
export type { CustomThemeOptions };