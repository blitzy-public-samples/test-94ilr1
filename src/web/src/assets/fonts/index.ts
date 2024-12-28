/**
 * Font asset exports and configurations implementing Material Design 3.0 typography system
 * @version 1.0.0
 * @license MIT
 */

/**
 * Base path for font assets
 * @constant
 */
const FONT_BASE_PATH = '/assets/fonts/inter' as const;

/**
 * Supported font weights following Material Design 3.0 specifications
 * @constant
 */
export const FONT_WEIGHTS = {
  light: 300,
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700
} as const;

/**
 * Supported font styles for typography consistency
 * @constant
 */
export const FONT_STYLES = {
  normal: 'normal',
  italic: 'italic'
} as const;

/**
 * Supported font formats for cross-browser compatibility
 * @constant
 */
export const FONT_FORMATS = {
  woff2: 'woff2',
  woff: 'woff'
} as const;

// Type definitions for type safety
type FontWeight = typeof FONT_WEIGHTS[keyof typeof FONT_WEIGHTS];
type FontStyle = typeof FONT_STYLES[keyof typeof FONT_STYLES];
type FontFormat = typeof FONT_FORMATS[keyof typeof FONT_FORMATS];

/**
 * Validates if a font weight is supported
 * @param weight - Font weight to validate
 * @returns True if weight is supported, false otherwise
 */
export const validateFontWeight = (weight: number): weight is FontWeight => {
  return Object.values(FONT_WEIGHTS).includes(weight);
};

/**
 * Validates if a font style is supported
 * @param style - Font style to validate
 * @returns True if style is supported, false otherwise
 */
export const validateFontStyle = (style: string): style is FontStyle => {
  return Object.values(FONT_STYLES).includes(style as FontStyle);
};

/**
 * Generates URL for a specific font variant
 * @param weight - Font weight
 * @param style - Font style
 * @param format - Font format
 * @returns URL to font file
 * @throws Error if parameters are invalid
 */
export const getFontUrl = (
  weight: FontWeight,
  style: FontStyle = FONT_STYLES.normal,
  format: FontFormat
): string => {
  if (!validateFontWeight(weight)) {
    throw new Error(`Unsupported font weight: ${weight}`);
  }
  if (!validateFontStyle(style)) {
    throw new Error(`Unsupported font style: ${style}`);
  }

  const weightName = Object.entries(FONT_WEIGHTS).find(
    ([, value]) => value === weight
  )?.[0];

  return `${FONT_BASE_PATH}/Inter-${weightName?.[0].toUpperCase()}${weightName?.slice(1)}${
    style === FONT_STYLES.italic ? 'Italic' : ''
  }.${format}`;
};

/**
 * Light weight Inter font URLs
 */
export const InterLight = {
  woff2: getFontUrl(FONT_WEIGHTS.light, FONT_STYLES.normal, FONT_FORMATS.woff2),
  woff: getFontUrl(FONT_WEIGHTS.light, FONT_STYLES.normal, FONT_FORMATS.woff)
} as const;

/**
 * Regular weight Inter font URLs
 */
export const InterRegular = {
  woff2: getFontUrl(FONT_WEIGHTS.regular, FONT_STYLES.normal, FONT_FORMATS.woff2),
  woff: getFontUrl(FONT_WEIGHTS.regular, FONT_STYLES.normal, FONT_FORMATS.woff)
} as const;

/**
 * Medium weight Inter font URLs
 */
export const InterMedium = {
  woff2: getFontUrl(FONT_WEIGHTS.medium, FONT_STYLES.normal, FONT_FORMATS.woff2),
  woff: getFontUrl(FONT_WEIGHTS.medium, FONT_STYLES.normal, FONT_FORMATS.woff)
} as const;

/**
 * Semi-bold weight Inter font URLs
 */
export const InterSemiBold = {
  woff2: getFontUrl(FONT_WEIGHTS.semibold, FONT_STYLES.normal, FONT_FORMATS.woff2),
  woff: getFontUrl(FONT_WEIGHTS.semibold, FONT_STYLES.normal, FONT_FORMATS.woff)
} as const;

/**
 * Bold weight Inter font URLs
 */
export const InterBold = {
  woff2: getFontUrl(FONT_WEIGHTS.bold, FONT_STYLES.normal, FONT_FORMATS.woff2),
  woff: getFontUrl(FONT_WEIGHTS.bold, FONT_STYLES.normal, FONT_FORMATS.woff)
} as const;

// Type-safe exports
export type { FontWeight, FontStyle, FontFormat };