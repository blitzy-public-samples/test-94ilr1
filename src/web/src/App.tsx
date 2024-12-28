import React, { useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { ThemeProvider, CssBaseline, useMediaQuery } from '@mui/material';
import { Auth0Provider } from '@auth0/auth0-react';

// Internal imports
import AuthLayout from './layouts/AuthLayout';
import DashboardLayout from './layouts/DashboardLayout';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { store } from './store';
import { ROUTES } from './constants/routes.constants';
import { UserRole } from './types/auth.types';
import useTheme from './hooks/useTheme';

// Auth0 configuration
const auth0Config = {
  domain: process.env.REACT_APP_AUTH0_DOMAIN || '',
  clientId: process.env.REACT_APP_AUTH0_CLIENT_ID || '',
  audience: process.env.REACT_APP_AUTH0_AUDIENCE || '',
  redirectUri: window.location.origin,
  scope: 'openid profile email offline_access'
};

/**
 * Theme wrapper component for dynamic theme management
 */
const ThemeWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { theme, mode } = useTheme();
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', mode);
  }, [mode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
};

/**
 * Root application component implementing comprehensive routing and security
 */
const App: React.FC = () => {
  // Auth0 callback handler
  const onRedirectCallback = useCallback((appState: any) => {
    window.history.replaceState(
      {},
      document.title,
      appState?.returnTo || window.location.pathname
    );
  }, []);

  // Error boundary handler
  const onError = useCallback((error: Error) => {
    console.error('Auth Error:', error);
    // Implement error reporting service integration here
  }, []);

  return (
    <Auth0Provider
      {...auth0Config}
      onRedirectCallback={onRedirectCallback}
      onError={onError}
    >
      <Provider store={store}>
        <ThemeWrapper>
          <BrowserRouter>
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<Navigate to={ROUTES.DASHBOARD.ROOT} replace />} />
              
              {/* Authentication routes */}
              <Route
                path={ROUTES.AUTH.LOGIN}
                element={
                  <AuthLayout
                    title="Sign In"
                    onAuthSuccess={() => {}}
                    onAuthError={() => {}}
                  />
                }
              />
              <Route
                path={ROUTES.AUTH.MFA}
                element={
                  <AuthLayout
                    title="Two-Factor Authentication"
                    onAuthSuccess={() => {}}
                    onAuthError={() => {}}
                  />
                }
              />

              {/* Protected dashboard routes */}
              <Route
                path={`${ROUTES.DASHBOARD.ROOT}/*`}
                element={
                  <ProtectedRoute
                    requiredRoles={[UserRole.USER, UserRole.MANAGER, UserRole.ADMIN]}
                    requireMfa={true}
                  >
                    <DashboardLayout pageTitle="Dashboard">
                      {/* Dashboard child routes will be handled by DashboardLayout */}
                    </DashboardLayout>
                  </ProtectedRoute>
                }
              />

              {/* Protected email management routes */}
              <Route
                path={`${ROUTES.EMAIL.ROOT}/*`}
                element={
                  <ProtectedRoute
                    requiredRoles={[UserRole.USER, UserRole.MANAGER, UserRole.ADMIN]}
                    requireMfa={true}
                  >
                    <DashboardLayout pageTitle="Email Management">
                      {/* Email management child routes will be handled by DashboardLayout */}
                    </DashboardLayout>
                  </ProtectedRoute>
                }
              />

              {/* Protected settings routes - Admin only */}
              <Route
                path={`${ROUTES.SETTINGS.ROOT}/*`}
                element={
                  <ProtectedRoute
                    requiredRoles={[UserRole.ADMIN]}
                    requireMfa={true}
                  >
                    <DashboardLayout pageTitle="Settings">
                      {/* Settings child routes will be handled by DashboardLayout */}
                    </DashboardLayout>
                  </ProtectedRoute>
                }
              />

              {/* Fallback route */}
              <Route path="*" element={<Navigate to={ROUTES.DASHBOARD.ROOT} replace />} />
            </Routes>
          </BrowserRouter>
        </ThemeWrapper>
      </Provider>
    </Auth0Provider>
  );
};

export default App;