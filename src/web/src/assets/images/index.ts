// Image assets index following Material Design 3.0 principles
// Version: 1.0.0

/**
 * Base path for all image assets
 * @constant
 */
export const IMAGE_BASE_PATH = '/assets/images';

/**
 * Supported screen breakpoints in pixels following Material Design responsive layout grid
 * @constant
 */
const BREAKPOINTS = {
  MOBILE: 320,
  TABLET: 768,
  DESKTOP: 1024,
  LARGE: 1440
} as const;

/**
 * Default avatar placeholder following Material Design 3.0 avatar guidelines
 * Supports responsive variants for different screen sizes
 */
export const defaultAvatar = {
  [BREAKPOINTS.MOBILE]: `${IMAGE_BASE_PATH}/avatar/default-avatar-32.webp`,
  [BREAKPOINTS.TABLET]: `${IMAGE_BASE_PATH}/avatar/default-avatar-48.webp`,
  [BREAKPOINTS.DESKTOP]: `${IMAGE_BASE_PATH}/avatar/default-avatar-64.webp`,
  [BREAKPOINTS.LARGE]: `${IMAGE_BASE_PATH}/avatar/default-avatar-80.webp`
};

/**
 * Application logo for light theme with responsive DPI variants
 * Following Material Design 3.0 branding guidelines
 */
export const logoLight = {
  '1x': `${IMAGE_BASE_PATH}/logo/logo-light.webp`,
  '2x': `${IMAGE_BASE_PATH}/logo/logo-light@2x.webp`,
  '3x': `${IMAGE_BASE_PATH}/logo/logo-light@3x.webp`
};

/**
 * Application logo for dark theme with responsive DPI variants
 * Following Material Design 3.0 branding guidelines
 */
export const logoDark = {
  '1x': `${IMAGE_BASE_PATH}/logo/logo-dark.webp`,
  '2x': `${IMAGE_BASE_PATH}/logo/logo-dark@2x.webp`,
  '3x': `${IMAGE_BASE_PATH}/logo/logo-dark@3x.webp`
};

/**
 * Material Design 3.0 compliant icons for different attachment types
 * Supports both light and dark theme variants
 */
export const attachmentIcons = {
  pdf: `${IMAGE_BASE_PATH}/attachments/pdf-icon.svg`,
  doc: `${IMAGE_BASE_PATH}/attachments/doc-icon.svg`,
  xls: `${IMAGE_BASE_PATH}/attachments/xls-icon.svg`,
  img: `${IMAGE_BASE_PATH}/attachments/img-icon.svg`,
  default: `${IMAGE_BASE_PATH}/attachments/default-icon.svg`
} as const;

/**
 * Empty state illustrations following Material Design 3.0 guidelines
 * Supports responsive variants and theme adaptation
 */
export const emptyStateImages = {
  emptyInbox: {
    light: {
      [BREAKPOINTS.MOBILE]: `${IMAGE_BASE_PATH}/empty-states/empty-inbox-light-sm.webp`,
      [BREAKPOINTS.TABLET]: `${IMAGE_BASE_PATH}/empty-states/empty-inbox-light-md.webp`,
      [BREAKPOINTS.DESKTOP]: `${IMAGE_BASE_PATH}/empty-states/empty-inbox-light-lg.webp`
    },
    dark: {
      [BREAKPOINTS.MOBILE]: `${IMAGE_BASE_PATH}/empty-states/empty-inbox-dark-sm.webp`,
      [BREAKPOINTS.TABLET]: `${IMAGE_BASE_PATH}/empty-states/empty-inbox-dark-md.webp`,
      [BREAKPOINTS.DESKTOP]: `${IMAGE_BASE_PATH}/empty-states/empty-inbox-dark-lg.webp`
    }
  },
  noResults: {
    light: {
      [BREAKPOINTS.MOBILE]: `${IMAGE_BASE_PATH}/empty-states/no-results-light-sm.webp`,
      [BREAKPOINTS.TABLET]: `${IMAGE_BASE_PATH}/empty-states/no-results-light-md.webp`,
      [BREAKPOINTS.DESKTOP]: `${IMAGE_BASE_PATH}/empty-states/no-results-light-lg.webp`
    },
    dark: {
      [BREAKPOINTS.MOBILE]: `${IMAGE_BASE_PATH}/empty-states/no-results-dark-sm.webp`,
      [BREAKPOINTS.TABLET]: `${IMAGE_BASE_PATH}/empty-states/no-results-dark-md.webp`,
      [BREAKPOINTS.DESKTOP]: `${IMAGE_BASE_PATH}/empty-states/no-results-dark-lg.webp`
    }
  },
  error: {
    light: {
      [BREAKPOINTS.MOBILE]: `${IMAGE_BASE_PATH}/empty-states/error-light-sm.webp`,
      [BREAKPOINTS.TABLET]: `${IMAGE_BASE_PATH}/empty-states/error-light-md.webp`,
      [BREAKPOINTS.DESKTOP]: `${IMAGE_BASE_PATH}/empty-states/error-light-lg.webp`
    },
    dark: {
      [BREAKPOINTS.MOBILE]: `${IMAGE_BASE_PATH}/empty-states/error-dark-sm.webp`,
      [BREAKPOINTS.TABLET]: `${IMAGE_BASE_PATH}/empty-states/error-dark-md.webp`,
      [BREAKPOINTS.DESKTOP]: `${IMAGE_BASE_PATH}/empty-states/error-dark-lg.webp`
    }
  }
} as const;

/**
 * Helper type for responsive image sets following Material Design breakpoints
 */
type ResponsiveImageSet = Record<keyof typeof BREAKPOINTS, string>;

/**
 * Mapping of responsive image variants for different screen breakpoints
 * Following Material Design 3.0 responsive layout guidelines
 */
export const responsiveImageSet: Record<string, ResponsiveImageSet> = {
  breakpoints: {
    [BREAKPOINTS.MOBILE]: `${BREAKPOINTS.MOBILE}px`,
    [BREAKPOINTS.TABLET]: `${BREAKPOINTS.TABLET}px`,
    [BREAKPOINTS.DESKTOP]: `${BREAKPOINTS.DESKTOP}px`,
    [BREAKPOINTS.LARGE]: `${BREAKPOINTS.LARGE}px`
  }
} as const;