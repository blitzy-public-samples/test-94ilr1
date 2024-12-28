// @cypress/types version ^12.0.0
// @auth0-js version ^9.20.0

import { AuthCredentials, AuthResponse, UserRole, MFAMethod } from '../../src/types/auth.types';
import Auth0 from 'auth0-js';

// Test configuration constants
const TEST_CONFIG = {
  baseUrl: 'http://localhost:3000',
  auth0: {
    domain: 'test.auth0.com',
    clientId: 'test-client-id',
    redirectUri: 'http://localhost:3000/callback'
  },
  apiRoutes: {
    login: '/api/v1/auth/login',
    mfa: '/api/v1/auth/mfa',
    oauth: '/api/v1/auth/oauth/callback',
    token: '/api/v1/auth/token'
  },
  testUser: {
    email: 'test@example.com',
    password: 'TestPassword123',
    mfaEnabled: true
  }
};

// Test selectors
const SELECTORS = {
  emailInput: '[data-testid=email-input]',
  passwordInput: '[data-testid=password-input]',
  loginButton: '[data-testid=login-button]',
  oauthButton: '[data-testid=oauth-login-button]',
  mfaInput: '[data-testid=mfa-input]',
  errorMessage: '[data-testid=error-message]'
};

describe('Authentication Flow', () => {
  let auth0Client: Auth0.WebAuth;

  beforeEach(() => {
    // Reset authentication state
    cy.clearCookies();
    cy.clearLocalStorage();

    // Initialize Auth0 client
    auth0Client = new Auth0.WebAuth({
      domain: TEST_CONFIG.auth0.domain,
      clientID: TEST_CONFIG.auth0.clientId,
      redirectUri: TEST_CONFIG.auth0.redirectUri,
      responseType: 'token id_token',
      scope: 'openid profile email'
    });

    // Setup API intercepts
    cy.intercept('POST', TEST_CONFIG.apiRoutes.login, (req) => {
      // Simulate successful login with MFA requirement
      req.reply({
        statusCode: 200,
        body: {
          requiresMFA: true,
          mfaChallengeId: 'test-challenge-id',
          mfaMethods: [MFAMethod.TOTP]
        }
      });
    }).as('loginRequest');

    cy.intercept('POST', TEST_CONFIG.apiRoutes.mfa, (req) => {
      // Simulate successful MFA verification
      req.reply({
        statusCode: 200,
        body: {
          user: {
            id: 'test-user-id',
            email: TEST_CONFIG.testUser.email,
            roles: [UserRole.USER],
            mfaEnabled: true
          },
          tokens: {
            accessToken: 'test-access-token',
            refreshToken: 'test-refresh-token',
            idToken: 'test-id-token',
            expiresIn: 3600,
            tokenType: 'Bearer'
          }
        }
      });
    }).as('mfaRequest');

    // Visit login page
    cy.visit('/login');
  });

  it('should handle standard email/password login with MFA', () => {
    // Attempt login with credentials
    cy.get(SELECTORS.emailInput).type(TEST_CONFIG.testUser.email);
    cy.get(SELECTORS.passwordInput).type(TEST_CONFIG.testUser.password);
    cy.get(SELECTORS.loginButton).click();

    // Wait for login request
    cy.wait('@loginRequest').then((interception) => {
      expect(interception.response?.statusCode).to.equal(200);
      expect(interception.response?.body.requiresMFA).to.be.true;
    });

    // Handle MFA challenge
    cy.get(SELECTORS.mfaInput).type('123456');
    cy.wait('@mfaRequest').then((interception) => {
      expect(interception.response?.statusCode).to.equal(200);
      expect(interception.response?.body.tokens).to.have.property('accessToken');
    });

    // Verify successful authentication
    cy.url().should('include', '/dashboard');
    cy.window().its('localStorage').should((storage) => {
      expect(storage.getItem('access_token')).to.exist;
    });
  });

  it('should handle OAuth2 authentication flow', () => {
    // Mock Auth0 authentication response
    const mockAuth0Response = {
      accessToken: 'oauth-access-token',
      idToken: 'oauth-id-token',
      state: 'test-state'
    };

    cy.intercept('GET', `https://${TEST_CONFIG.auth0.domain}/authorize*`, (req) => {
      // Simulate Auth0 redirect
      const callbackUrl = `${TEST_CONFIG.baseUrl}/callback#access_token=${mockAuth0Response.accessToken}&id_token=${mockAuth0Response.idToken}&state=${mockAuth0Response.state}`;
      req.redirect(callbackUrl);
    }).as('auth0Authorize');

    cy.intercept('POST', TEST_CONFIG.apiRoutes.oauth, {
      statusCode: 200,
      body: {
        user: {
          id: 'oauth-user-id',
          email: 'oauth@example.com',
          roles: [UserRole.USER]
        },
        tokens: mockAuth0Response
      }
    }).as('oauthCallback');

    // Initiate OAuth flow
    cy.get(SELECTORS.oauthButton).click();
    cy.wait('@auth0Authorize');
    cy.wait('@oauthCallback');

    // Verify successful OAuth authentication
    cy.url().should('include', '/dashboard');
    cy.window().its('localStorage').should((storage) => {
      expect(storage.getItem('access_token')).to.equal(mockAuth0Response.accessToken);
    });
  });

  it('should handle authentication errors gracefully', () => {
    // Mock failed login attempt
    cy.intercept('POST', TEST_CONFIG.apiRoutes.login, {
      statusCode: 401,
      body: {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password'
      }
    }).as('failedLogin');

    // Attempt login with invalid credentials
    cy.get(SELECTORS.emailInput).type('invalid@example.com');
    cy.get(SELECTORS.passwordInput).type('wrongpassword');
    cy.get(SELECTORS.loginButton).click();

    // Verify error handling
    cy.wait('@failedLogin');
    cy.get(SELECTORS.errorMessage)
      .should('be.visible')
      .and('contain', 'Invalid email or password');
  });

  it('should handle token refresh flow', () => {
    // Mock token refresh
    cy.intercept('POST', TEST_CONFIG.apiRoutes.token, {
      statusCode: 200,
      body: {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresIn: 3600
      }
    }).as('tokenRefresh');

    // Setup expired token scenario
    cy.window().then((window) => {
      window.localStorage.setItem('access_token', 'expired-token');
      window.localStorage.setItem('refresh_token', 'valid-refresh-token');
    });

    // Trigger token refresh
    cy.visit('/dashboard');
    cy.wait('@tokenRefresh');

    // Verify token update
    cy.window().its('localStorage').should((storage) => {
      expect(storage.getItem('access_token')).to.equal('new-access-token');
    });
  });
});