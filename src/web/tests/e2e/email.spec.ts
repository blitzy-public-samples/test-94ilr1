/**
 * @fileoverview End-to-end test suite for email functionality
 * Tests inbox viewing, email composition, context panel interactions, and response generation
 * @version 1.0.0
 */

import { IEmailMessage, IEmailThread, EmailPriority, EmailStatus } from '../../src/types/email.types';
import type { IContext, IRelationshipGraph } from '../../src/types/context.types';

// Test data constants
const TEST_EMAIL_THREAD: IEmailThread = {
  threadId: 'thread-123',
  subject: 'Project Update',
  messages: [
    {
      messageId: 'msg-1',
      threadId: 'thread-123',
      accountId: 'acc-1',
      subject: 'Project Update',
      content: 'Initial message content',
      fromAddress: 'sender@example.com',
      toAddresses: ['recipient@example.com'],
      ccAddresses: [],
      bccAddresses: [],
      attachments: [],
      priority: EmailPriority.HIGH,
      status: EmailStatus.READ,
      sentAt: new Date('2023-10-20T10:00:00Z'),
      receivedAt: new Date('2023-10-20T10:00:05Z'),
      headers: {},
      metadata: {}
    },
    {
      messageId: 'msg-2',
      threadId: 'thread-123',
      accountId: 'acc-1',
      subject: 'Re: Project Update',
      content: 'Follow-up message content',
      fromAddress: 'recipient@example.com',
      toAddresses: ['sender@example.com'],
      ccAddresses: [],
      bccAddresses: [],
      attachments: [],
      priority: EmailPriority.MEDIUM,
      status: EmailStatus.UNREAD,
      sentAt: new Date('2023-10-20T10:30:00Z'),
      receivedAt: new Date('2023-10-20T10:30:05Z'),
      headers: {},
      metadata: {}
    }
  ],
  participants: ['sender@example.com', 'recipient@example.com'],
  lastMessageAt: new Date('2023-10-20T10:30:05Z'),
  unreadCount: 1
};

describe('Email Management System E2E Tests', () => {
  beforeEach(() => {
    // Reset database state and seed test data
    cy.task('db:reset');
    cy.task('db:seed', { emails: [TEST_EMAIL_THREAD] });

    // Mock API endpoints
    cy.intercept('GET', '/api/v1/emails', { fixture: 'emails.json' }).as('getEmails');
    cy.intercept('GET', '/api/v1/emails/*', { fixture: 'email-thread.json' }).as('getThread');
    cy.intercept('GET', '/api/v1/context/*', { fixture: 'context-data.json' }).as('getContext');

    // Set up WebSocket mock for real-time updates
    cy.task('mockWebSocket', '/api/v1/emails/realtime');

    // Visit inbox with authentication
    cy.login();
    cy.visit('/inbox');
    cy.wait('@getEmails');
  });

  describe('Inbox View', () => {
    it('should display email threads with correct grouping', () => {
      cy.get('[data-testid="email-thread-list"]')
        .should('be.visible')
        .within(() => {
          cy.get('[data-testid="thread-item"]')
            .should('have.length.at.least', 1)
            .first()
            .should('contain', TEST_EMAIL_THREAD.subject);
        });

      // Verify thread metadata
      cy.get('[data-testid="thread-metadata"]').first().within(() => {
        cy.get('[data-testid="participant-count"]')
          .should('contain', TEST_EMAIL_THREAD.participants.length);
        cy.get('[data-testid="unread-count"]')
          .should('contain', TEST_EMAIL_THREAD.unreadCount);
      });
    });

    it('should handle real-time email updates', () => {
      const newEmail: IEmailMessage = {
        messageId: 'msg-3',
        threadId: TEST_EMAIL_THREAD.threadId,
        subject: 'Re: Project Update',
        // ... other required properties
        priority: EmailPriority.HIGH,
        status: EmailStatus.UNREAD
      } as IEmailMessage;

      // Simulate real-time email arrival
      cy.window().then((win) => {
        win.postMessage({
          type: 'newEmail',
          data: newEmail
        }, '*');
      });

      // Verify UI updates
      cy.get(`[data-testid="thread-${TEST_EMAIL_THREAD.threadId}"]`)
        .should('contain', 'New message')
        .and('have.class', 'unread');

      // Verify notification
      cy.get('[data-testid="notification-toast"]')
        .should('be.visible')
        .and('contain', 'New email received');
    });

    it('should support email filtering and search', () => {
      // Test priority filter
      cy.get('[data-testid="priority-filter"]').click();
      cy.get('[data-testid="priority-high"]').click();
      cy.get('[data-testid="thread-list"]')
        .should('contain', 'HIGH')
        .and('not.contain', 'NORMAL');

      // Test search functionality
      cy.get('[data-testid="search-input"]')
        .type('Project Update');
      cy.get('[data-testid="thread-list"]')
        .should('contain', TEST_EMAIL_THREAD.subject);
    });
  });

  describe('Context Panel', () => {
    beforeEach(() => {
      cy.get(`[data-testid="thread-${TEST_EMAIL_THREAD.threadId}"]`).click();
      cy.wait('@getContext');
    });

    it('should display relationship graph correctly', () => {
      cy.get('[data-testid="relationship-graph"]').within(() => {
        cy.get('.nodes').children().should('have.length.at.least', 2);
        cy.get('.edges').children().should('exist');
      });

      // Test graph interactions
      cy.get('[data-testid="graph-node"]').first().click();
      cy.get('[data-testid="node-details"]')
        .should('be.visible')
        .and('contain', TEST_EMAIL_THREAD.participants[0]);
    });

    it('should update context data in real-time', () => {
      const newContextData = {
        projectId: 'proj-123',
        relationships: ['user-3'],
        priority: 'HIGH'
      };

      // Simulate context update
      cy.window().then((win) => {
        win.postMessage({
          type: 'contextUpdate',
          data: newContextData
        }, '*');
      });

      // Verify UI updates
      cy.get('[data-testid="context-panel"]')
        .should('contain', 'user-3')
        .and('have.class', 'high-priority');
    });
  });

  describe('Response Generation', () => {
    beforeEach(() => {
      cy.get(`[data-testid="thread-${TEST_EMAIL_THREAD.threadId}"]`).click();
      cy.get('[data-testid="compose-response"]').click();
    });

    it('should generate AI responses with proper context', () => {
      // Wait for AI suggestion
      cy.get('[data-testid="ai-suggestion"]', { timeout: 10000 })
        .should('be.visible');

      // Verify context awareness
      cy.get('[data-testid="response-preview"]')
        .should('contain', TEST_EMAIL_THREAD.subject)
        .and('contain', 'Project');

      // Test template customization
      cy.get('[data-testid="template-selector"]').click();
      cy.get('[data-testid="template-formal"]').click();
      cy.get('[data-testid="response-preview"]')
        .should('contain', 'Dear');
    });

    it('should handle response generation errors gracefully', () => {
      // Simulate API error
      cy.intercept('POST', '/api/v1/responses/generate', {
        statusCode: 500,
        body: { error: 'Generation failed' }
      });

      cy.get('[data-testid="generate-response"]').click();
      cy.get('[data-testid="error-message"]')
        .should('be.visible')
        .and('contain', 'Generation failed');

      // Verify fallback to manual mode
      cy.get('[data-testid="manual-compose"]')
        .should('be.visible')
        .and('be.enabled');
    });
  });

  describe('Accessibility and Responsive Design', () => {
    it('should maintain accessibility standards', () => {
      // Run accessibility audit
      cy.injectAxe();
      cy.checkA11y('[data-testid="email-app"]', {
        rules: {
          'color-contrast': { enabled: true },
          'aria-required-parent': { enabled: true }
        }
      });
    });

    it('should adapt to mobile viewport', () => {
      // Test mobile responsiveness
      cy.viewport('iphone-x');
      
      // Verify mobile layout
      cy.get('[data-testid="mobile-menu"]').should('be.visible');
      cy.get('[data-testid="context-panel"]').should('not.be.visible');
      
      // Test mobile navigation
      cy.get('[data-testid="mobile-menu"]').click();
      cy.get('[data-testid="mobile-nav"]')
        .should('be.visible')
        .within(() => {
          cy.get('[data-testid="inbox-link"]').should('exist');
          cy.get('[data-testid="settings-link"]').should('exist');
        });
    });
  });
});