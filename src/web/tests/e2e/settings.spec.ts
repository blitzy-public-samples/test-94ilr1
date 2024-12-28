/**
 * @fileoverview End-to-end test suite for settings functionality
 * Tests account, email, security, and notification settings pages
 * @version 1.0.0
 */

import { ROUTES } from '../../src/constants/routes.constants';

// Test data constants
const TEST_USER = {
  email: 'test@example.com',
  password: 'Test123!@#',
  name: 'Test User'
};

const TEST_IMAGE_PATH = 'cypress/fixtures/profile.jpg';
const TEST_SMTP = {
  host: 'smtp.gmail.com',
  port: 587,
  username: 'test@gmail.com',
  password: 'app-specific-password'
};

describe('Settings Page E2E Tests', () => {
  beforeEach(() => {
    // Reset application state
    cy.clearCookies();
    cy.clearLocalStorage();
    
    // Reset test database
    cy.task('resetDb');
    
    // Setup API interceptors
    cy.intercept('GET', '/api/settings/**').as('getSettings');
    cy.intercept('PUT', '/api/settings/**').as('updateSettings');
    cy.intercept('POST', '/api/upload').as('uploadFile');
    
    // Login and navigate to settings
    cy.login(TEST_USER);
    cy.visit(ROUTES.SETTINGS.ROOT);
    cy.wait('@getSettings');
  });

  describe('Account Settings', () => {
    beforeEach(() => {
      cy.visit(ROUTES.SETTINGS.ACCOUNT);
      cy.wait('@getSettings');
    });

    it('should display current user profile information', () => {
      cy.get('[data-testid="profile-name"]').should('have.value', TEST_USER.name);
      cy.get('[data-testid="profile-email"]').should('have.value', TEST_USER.email);
    });

    it('should successfully update profile information', () => {
      const newName = 'Updated Name';
      
      cy.get('[data-testid="profile-name"]').clear().type(newName);
      cy.get('[data-testid="save-profile"]').click();
      
      cy.wait('@updateSettings').its('response.statusCode').should('eq', 200);
      cy.get('[data-testid="success-toast"]').should('be.visible');
      
      // Verify persistence
      cy.reload();
      cy.get('[data-testid="profile-name"]').should('have.value', newName);
    });

    it('should handle profile image upload', () => {
      cy.get('[data-testid="profile-image-upload"]')
        .attachFile(TEST_IMAGE_PATH);
      
      cy.wait('@uploadFile').its('response.statusCode').should('eq', 200);
      cy.get('[data-testid="profile-image"]')
        .should('have.attr', 'src')
        .and('include', 'profile-images/');
    });

    it('should validate form fields', () => {
      cy.get('[data-testid="profile-name"]').clear();
      cy.get('[data-testid="save-profile"]').click();
      
      cy.get('[data-testid="name-error"]')
        .should('be.visible')
        .and('contain', 'Name is required');
    });
  });

  describe('Email Settings', () => {
    beforeEach(() => {
      cy.visit(ROUTES.SETTINGS.EMAIL);
      cy.wait('@getSettings');
    });

    it('should configure SMTP settings', () => {
      cy.get('[data-testid="smtp-host"]').clear().type(TEST_SMTP.host);
      cy.get('[data-testid="smtp-port"]').clear().type(TEST_SMTP.port.toString());
      cy.get('[data-testid="smtp-username"]').clear().type(TEST_SMTP.username);
      cy.get('[data-testid="smtp-password"]').clear().type(TEST_SMTP.password);
      
      cy.get('[data-testid="test-connection"]').click();
      cy.wait('@updateSettings');
      
      cy.get('[data-testid="success-toast"]')
        .should('be.visible')
        .and('contain', 'Connection successful');
    });

    it('should manage email filter rules', () => {
      cy.get('[data-testid="add-filter"]').click();
      
      cy.get('[data-testid="filter-condition"]').type('subject:important');
      cy.get('[data-testid="filter-action"]').select('Mark as important');
      
      cy.get('[data-testid="save-filter"]').click();
      cy.wait('@updateSettings');
      
      cy.get('[data-testid="filter-list"]')
        .should('contain', 'subject:important')
        .and('contain', 'Mark as important');
    });

    it('should configure auto-response settings', () => {
      cy.get('[data-testid="enable-auto-response"]').check();
      cy.get('[data-testid="auto-response-template"]')
        .type('I am currently out of office until {date}');
      
      cy.get('[data-testid="save-email-settings"]').click();
      cy.wait('@updateSettings');
      
      cy.get('[data-testid="success-toast"]').should('be.visible');
    });
  });

  describe('Security Settings', () => {
    beforeEach(() => {
      cy.visit(ROUTES.SETTINGS.SECURITY);
      cy.wait('@getSettings');
    });

    it('should enable and configure MFA', () => {
      cy.get('[data-testid="enable-mfa"]').click();
      cy.wait('@updateSettings');
      
      // Verify QR code display
      cy.get('[data-testid="mfa-qr-code"]').should('be.visible');
      
      // Simulate MFA code entry
      cy.get('[data-testid="mfa-code"]').type('123456');
      cy.get('[data-testid="verify-mfa"]').click();
      
      cy.get('[data-testid="mfa-status"]')
        .should('contain', 'MFA is enabled');
    });

    it('should change password successfully', () => {
      const newPassword = 'NewTest123!@#';
      
      cy.get('[data-testid="current-password"]').type(TEST_USER.password);
      cy.get('[data-testid="new-password"]').type(newPassword);
      cy.get('[data-testid="confirm-password"]').type(newPassword);
      
      cy.get('[data-testid="change-password"]').click();
      cy.wait('@updateSettings');
      
      cy.get('[data-testid="success-toast"]')
        .should('contain', 'Password updated successfully');
    });

    it('should manage active sessions', () => {
      cy.get('[data-testid="session-list"]').should('be.visible');
      cy.get('[data-testid="revoke-session"]').first().click();
      
      cy.wait('@updateSettings');
      cy.get('[data-testid="success-toast"]')
        .should('contain', 'Session revoked successfully');
    });
  });

  describe('Notification Settings', () => {
    beforeEach(() => {
      cy.visit(ROUTES.SETTINGS.NOTIFICATIONS);
      cy.wait('@getSettings');
    });

    it('should configure email notifications', () => {
      cy.get('[data-testid="email-notifications"]').check();
      cy.get('[data-testid="notification-frequency"]').select('daily');
      
      cy.get('[data-testid="save-notifications"]').click();
      cy.wait('@updateSettings');
      
      cy.get('[data-testid="success-toast"]').should('be.visible');
    });

    it('should set quiet hours', () => {
      cy.get('[data-testid="enable-quiet-hours"]').check();
      cy.get('[data-testid="quiet-hours-start"]').type('22:00');
      cy.get('[data-testid="quiet-hours-end"]').type('07:00');
      
      cy.get('[data-testid="save-notifications"]').click();
      cy.wait('@updateSettings');
      
      cy.get('[data-testid="success-toast"]').should('be.visible');
    });

    it('should configure notification channels', () => {
      cy.get('[data-testid="channel-email"]').check();
      cy.get('[data-testid="channel-browser"]').check();
      cy.get('[data-testid="channel-mobile"]').uncheck();
      
      cy.get('[data-testid="save-notifications"]').click();
      cy.wait('@updateSettings');
      
      // Verify persistence
      cy.reload();
      cy.get('[data-testid="channel-email"]').should('be.checked');
      cy.get('[data-testid="channel-browser"]').should('be.checked');
      cy.get('[data-testid="channel-mobile"]').should('not.be.checked');
    });
  });

  // Test accessibility across all settings pages
  describe('Accessibility', () => {
    const pages = [
      ROUTES.SETTINGS.ACCOUNT,
      ROUTES.SETTINGS.EMAIL,
      ROUTES.SETTINGS.SECURITY,
      ROUTES.SETTINGS.NOTIFICATIONS
    ];

    pages.forEach(page => {
      it(`should meet accessibility standards on ${page}`, () => {
        cy.visit(page);
        cy.wait('@getSettings');
        cy.injectAxe();
        cy.checkA11y();
      });
    });
  });
});