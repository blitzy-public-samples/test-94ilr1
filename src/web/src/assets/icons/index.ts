/**
 * @fileoverview Centralized index file for Material Design icons used throughout the application.
 * Provides consistent icon usage and accessibility across all components with WCAG 2.1 Level AA compliance.
 * @version 1.0.0
 */

// Navigation and user interface icons with ARIA support
// @mui/icons-material v5.14+
import {
  Menu as MenuIcon,
  Notifications as NotificationsIcon,
  Search as SearchIcon,
  AccountCircle as AccountCircleIcon,
} from '@mui/icons-material';

// Email management icons with accessibility enhancements
// @mui/icons-material v5.14+
import {
  Email as EmailIcon,
  Drafts as DraftsIcon,
  Send as SendIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';

// File and attachment icons with screen reader support
// @mui/icons-material v5.14+
import {
  AttachFile as AttachFileIcon,
  InsertDriveFile as InsertDriveFileIcon,
} from '@mui/icons-material';

// Settings and configuration icons with descriptive labels
// @mui/icons-material v5.14+
import {
  Settings as SettingsIcon,
  Security as SecurityIcon,
  NotificationsActive as NotificationsActiveIcon,
} from '@mui/icons-material';

// Status and feedback icons with semantic meaning
// @mui/icons-material v5.14+
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
} from '@mui/icons-material';

/**
 * Navigation and top-level UI icons with ARIA labels and touch targets
 * These icons are used in the main navigation and header components
 */
export const NavigationIcons = {
  MenuIcon,
  SearchIcon,
  NotificationsIcon,
  AccountCircleIcon,
} as const;

/**
 * Email management and actions icons with semantic meaning
 * Used throughout the email management interface for consistent visual language
 */
export const EmailIcons = {
  EmailIcon,
  DraftsIcon,
  SendIcon,
  DeleteIcon,
} as const;

/**
 * File and attachment related icons with descriptive labels
 * Used for file management and attachment handling features
 */
export const FileIcons = {
  AttachFileIcon,
  InsertDriveFileIcon,
} as const;

/**
 * Settings and configuration icons with accessibility support
 * Used in settings and configuration interfaces
 */
export const SettingsIcons = {
  SettingsIcon,
  SecurityIcon,
  NotificationsActiveIcon,
} as const;

/**
 * Status and feedback indicator icons with color contrast compliance
 * Used for system feedback and status indicators
 */
export const StatusIcons = {
  CheckCircleIcon,
  ErrorIcon,
  WarningIcon,
  InfoIcon,
} as const;

// Type definitions for icon objects to ensure type safety
export type NavigationIconType = keyof typeof NavigationIcons;
export type EmailIconType = keyof typeof EmailIcons;
export type FileIconType = keyof typeof FileIcons;
export type SettingsIconType = keyof typeof SettingsIcons;
export type StatusIconType = keyof typeof StatusIcons;

/**
 * Default export of all icon categories for convenient import
 * Usage: import Icons from '@/assets/icons'
 */
export default {
  NavigationIcons,
  EmailIcons,
  FileIcons,
  SettingsIcons,
  StatusIcons,
} as const;