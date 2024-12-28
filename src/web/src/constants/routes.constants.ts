/**
 * @fileoverview Centralized route configuration constants for the email management platform.
 * Defines all application routes, route parameters, and navigation paths with TypeScript type safety.
 * @version 1.0.0
 */

/**
 * Route parameter definitions for dynamic route generation
 */
export const ROUTE_PARAMS = {
  THREAD_ID: ':threadId',
  DRAFT_ID: ':draftId',
  TOKEN: ':token',
  PROJECT_ID: ':projectId'
} as const;

/**
 * Main application routes configuration object
 */
export const ROUTES = {
  AUTH: {
    ROOT: '/auth',
    LOGIN: '/auth/login',
    MFA: '/auth/mfa',
    LOGOUT: '/auth/logout',
    REGISTER: '/auth/register',
    FORGOT_PASSWORD: '/auth/forgot-password',
    RESET_PASSWORD: `/auth/reset-password/${ROUTE_PARAMS.TOKEN}`
  },
  DASHBOARD: {
    ROOT: '/dashboard',
    ANALYTICS: '/dashboard/analytics',
    OVERVIEW: '/dashboard/overview',
    PROJECTS: '/dashboard/projects',
    CALENDAR: '/dashboard/calendar'
  },
  EMAIL: {
    ROOT: '/email',
    INBOX: '/email/inbox',
    SENT: '/email/sent',
    DRAFTS: '/email/drafts',
    ARCHIVED: '/email/archived',
    THREAD: `/email/thread/${ROUTE_PARAMS.THREAD_ID}`,
    COMPOSE: '/email/compose',
    DRAFT: `/email/draft/${ROUTE_PARAMS.DRAFT_ID}`,
    TEMPLATES: '/email/templates',
    SEARCH: '/email/search'
  },
  SETTINGS: {
    ROOT: '/settings',
    ACCOUNT: '/settings/account',
    EMAIL: '/settings/email',
    NOTIFICATIONS: '/settings/notifications',
    SECURITY: '/settings/security',
    PREFERENCES: '/settings/preferences',
    INTEGRATIONS: '/settings/integrations',
    API: '/settings/api'
  }
} as const;

/**
 * Default redirect path when no specific route is specified
 */
export const DEFAULT_REDIRECT = ROUTES.DASHBOARD.ROOT;

/**
 * Default authentication redirect path
 */
export const AUTH_REDIRECT = ROUTES.AUTH.LOGIN;

/**
 * Type guard to validate thread ID format
 */
const isValidThreadId = (threadId: string): boolean => {
  return /^[a-zA-Z0-9-_]+$/.test(threadId);
};

/**
 * Type guard to validate draft ID format
 */
const isValidDraftId = (draftId: string): boolean => {
  return /^[a-zA-Z0-9-_]+$/.test(draftId);
};

/**
 * Type guard to validate token format
 */
const isValidToken = (token: string): boolean => {
  return /^[a-zA-Z0-9-_]+$/.test(token);
};

/**
 * Generates a thread route with the given thread ID
 * @param threadId - The unique identifier for the email thread
 * @throws {Error} If threadId is invalid or empty
 * @returns Complete thread route path
 */
export const getThreadRoute = (threadId: string): string => {
  if (!threadId || !isValidThreadId(threadId)) {
    throw new Error('Invalid thread ID provided');
  }
  return ROUTES.EMAIL.THREAD.replace(ROUTE_PARAMS.THREAD_ID, threadId);
};

/**
 * Generates a draft route with the given draft ID
 * @param draftId - The unique identifier for the email draft
 * @throws {Error} If draftId is invalid or empty
 * @returns Complete draft route path
 */
export const getDraftRoute = (draftId: string): string => {
  if (!draftId || !isValidDraftId(draftId)) {
    throw new Error('Invalid draft ID provided');
  }
  return ROUTES.EMAIL.DRAFT.replace(ROUTE_PARAMS.DRAFT_ID, draftId);
};

/**
 * Generates a password reset route with the given token
 * @param token - The password reset token
 * @throws {Error} If token is invalid or empty
 * @returns Complete password reset route path
 */
export const getResetPasswordRoute = (token: string): string => {
  if (!token || !isValidToken(token)) {
    throw new Error('Invalid reset token provided');
  }
  return ROUTES.AUTH.RESET_PASSWORD.replace(ROUTE_PARAMS.TOKEN, token);
};

/**
 * Type definitions for route parameters to ensure type safety
 */
export type RouteParams = typeof ROUTE_PARAMS;
export type Routes = typeof ROUTES;

/**
 * Type guard to check if a string is a valid route
 */
export const isValidRoute = (route: string): route is keyof Routes => {
  return Object.values(ROUTES).some(routeGroup => 
    Object.values(routeGroup).includes(route as any)
  );
};

// Freeze objects to prevent runtime modifications
Object.freeze(ROUTE_PARAMS);
Object.freeze(ROUTES);