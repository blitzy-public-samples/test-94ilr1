import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { axe } from '@axe-core/react';
import { Auth0Provider } from '@auth0/auth0-react';

import LoginForm from '../../../src/components/auth/LoginForm';
import MFAForm from '../../../src/components/auth/MFAForm';
import ProtectedRoute from '../../../src/components/auth/ProtectedRoute';
import { useAuth } from '../../../src/hooks/useAuth';
import { UserRole, MFAMethod } from '../../../src/types/auth.types';

// Mock useAuth hook
vi.mock('../../../src/hooks/useAuth', () => ({
  useAuth: vi.fn()
}));

// Test utilities
const renderWithAuth = (component: React.ReactNode, initialEntries = ['/']) => {
  return render(
    <Auth0Provider
      domain="test.auth0.com"
      clientId="test-client-id"
      authorizationParams={{
        redirect_uri: window.location.origin
      }}
    >
      <MemoryRouter initialEntries={initialEntries}>
        {component}
      </MemoryRouter>
    </Auth0Provider>
  );
};

describe('LoginForm', () => {
  const mockLogin = vi.fn();
  const mockOnSuccess = vi.fn();

  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      login: mockLogin,
      loading: false,
      error: null,
      isAuthenticated: false,
      validateSession: vi.fn(),
      checkRoleAccess: vi.fn()
    } as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should render login form with accessibility features', async () => {
    const { container } = renderWithAuth(
      <LoginForm onSuccess={mockOnSuccess} />
    );

    // Check accessibility
    const results = await axe(container);
    expect(results).toHaveNoViolations();

    // Verify ARIA labels
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('should validate email format with security checks', async () => {
    renderWithAuth(<LoginForm onSuccess={mockOnSuccess} />);

    const emailInput = screen.getByLabelText(/email address/i);
    await userEvent.type(emailInput, 'invalid-email');

    expect(screen.getByText(/enter a valid email address/i)).toBeInTheDocument();

    // Test XSS prevention
    await userEvent.type(emailInput, '<script>alert("xss")</script>@test.com');
    expect(emailInput).toHaveValue('alertxsstest.com@test.com');
  });

  it('should enforce password complexity requirements', async () => {
    renderWithAuth(<LoginForm onSuccess={mockOnSuccess} />);

    const passwordInput = screen.getByLabelText(/password/i);
    await userEvent.type(passwordInput, 'weak');

    expect(screen.getByText(/password must be at least 8 characters/i)).toBeInTheDocument();
  });

  it('should handle rate limiting for login attempts', async () => {
    renderWithAuth(<LoginForm onSuccess={mockOnSuccess} maxAttempts={3} />);

    const submitButton = screen.getByRole('button', { name: /sign in/i });

    // Simulate multiple failed attempts
    for (let i = 0; i < 3; i++) {
      await userEvent.click(submitButton);
    }

    expect(screen.getByText(/too many failed attempts/i)).toBeInTheDocument();
    expect(submitButton).toBeDisabled();
  });

  it('should handle successful login with MFA requirement', async () => {
    mockLogin.mockResolvedValueOnce({
      requiresMFA: true,
      mfaChallengeId: 'test-challenge'
    });

    renderWithAuth(<LoginForm onSuccess={mockOnSuccess} />);

    await userEvent.type(screen.getByLabelText(/email address/i), 'test@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'SecurePass123!');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'SecurePass123!',
        rememberMe: false
      });
    });
  });
});

describe('MFAForm', () => {
  const mockVerifyMFA = vi.fn();
  const mockOnSuccess = vi.fn();
  const mockOnError = vi.fn();

  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      verifyMFA: mockVerifyMFA,
      loading: false,
      error: null
    } as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should render MFA form with accessibility support', async () => {
    const { container } = renderWithAuth(
      <MFAForm
        challengeId="test-challenge"
        onSuccess={mockOnSuccess}
        onError={mockOnError}
      />
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should validate MFA code format', async () => {
    renderWithAuth(
      <MFAForm
        challengeId="test-challenge"
        onSuccess={mockOnSuccess}
        onError={mockOnError}
      />
    );

    const codeInput = screen.getByLabelText(/verification code/i);
    await userEvent.type(codeInput, 'abc');

    expect(screen.getByText(/code must be 6 digits/i)).toBeInTheDocument();
  });

  it('should handle rate limiting for verification attempts', async () => {
    renderWithAuth(
      <MFAForm
        challengeId="test-challenge"
        onSuccess={mockOnSuccess}
        onError={mockOnError}
        maxAttempts={3}
      />
    );

    const codeInput = screen.getByLabelText(/verification code/i);
    const submitButton = screen.getByRole('button', { name: /verify/i });

    // Simulate failed attempts
    for (let i = 0; i < 3; i++) {
      await userEvent.type(codeInput, '123456');
      await userEvent.click(submitButton);
      await userEvent.clear(codeInput);
    }

    expect(screen.getByText(/maximum attempts exceeded/i)).toBeInTheDocument();
    expect(submitButton).toBeDisabled();
  });

  it('should handle successful MFA verification', async () => {
    mockVerifyMFA.mockResolvedValueOnce({ success: true });

    renderWithAuth(
      <MFAForm
        challengeId="test-challenge"
        onSuccess={mockOnSuccess}
        onError={mockOnError}
      />
    );

    await userEvent.type(screen.getByLabelText(/verification code/i), '123456');
    await userEvent.click(screen.getByRole('button', { name: /verify/i }));

    await waitFor(() => {
      expect(mockVerifyMFA).toHaveBeenCalledWith({
        code: '123456',
        challengeId: 'test-challenge',
        method: MFAMethod.TOTP
      });
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });
});

describe('ProtectedRoute', () => {
  const mockValidateSession = vi.fn();
  const mockCheckRoleAccess = vi.fn();

  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      validateSession: mockValidateSession,
      checkRoleAccess: mockCheckRoleAccess,
      loading: false
    } as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should handle role-based access control', async () => {
    mockCheckRoleAccess.mockReturnValue(true);

    renderWithAuth(
      <Routes>
        <Route
          path="/"
          element={
            <ProtectedRoute requiredRoles={[UserRole.MANAGER]}>
              <div>Protected Content</div>
            </ProtectedRoute>
          }
        />
        <Route path="/unauthorized" element={<div>Unauthorized</div>} />
      </Routes>
    );

    await waitFor(() => {
      expect(screen.getByText(/protected content/i)).toBeInTheDocument();
    });
  });

  it('should redirect on session timeout', async () => {
    mockValidateSession.mockReturnValue(false);

    renderWithAuth(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>
    );

    await waitFor(() => {
      expect(window.location.pathname).toBe('/auth/login');
    });
  });

  it('should enforce MFA requirement', async () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      validateSession: mockValidateSession,
      checkRoleAccess: mockCheckRoleAccess,
      loading: false,
      mfaCompleted: false
    } as any);

    renderWithAuth(
      <ProtectedRoute requireMfa={true}>
        <div>Protected Content</div>
      </ProtectedRoute>
    );

    await waitFor(() => {
      expect(window.location.pathname).toBe('/auth/mfa');
    });
  });
});