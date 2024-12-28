// @ts-check
import { ResponseTone, ResponseStatus } from '../../src/types/response.types';
import 'cypress-axe'; // v1.4.0 - Accessibility testing

/**
 * End-to-end tests for email response generation and management functionality
 * @package cypress v12.0.0
 */
describe('Response Generation Flow', () => {
  beforeEach(() => {
    // Set up authentication and initial state
    cy.intercept('POST', '/api/v1/responses/generate', {
      fixture: 'responseGeneration.json'
    }).as('generateResponse');

    cy.intercept('GET', '/api/v1/templates*', {
      fixture: 'templates.json'
    }).as('loadTemplates');

    // Visit response page with test email context
    cy.visit('/response/new?emailId=test-email-123');
    
    // Initialize accessibility testing
    cy.injectAxe();
    
    // Set viewport for responsive testing
    cy.viewport('macbook-15');
  });

  describe('Response Editor Tests', () => {
    it('should load response editor with initial content', () => {
      // Verify editor component rendering
      cy.get('[data-testid="response-editor"]').should('be.visible');
      
      // Check accessibility
      cy.checkA11y('[data-testid="response-editor"]');
      
      // Verify rich text controls
      cy.get('[data-testid="formatting-toolbar"]')
        .should('be.visible')
        .within(() => {
          cy.get('[data-testid="bold-button"]').should('be.enabled');
          cy.get('[data-testid="italic-button"]').should('be.enabled');
          cy.get('[data-testid="bullet-list-button"]').should('be.enabled');
        });

      // Test character counter
      cy.get('[data-testid="char-counter"]').should('contain', '0/5000');
    });

    it('should handle tone selection and updates', () => {
      // Test all available tone options
      Object.values(ResponseTone).forEach(tone => {
        cy.get('[data-testid="tone-selector"]').click();
        cy.get(`[data-testid="tone-option-${tone}"]`).click();
        cy.get('[data-testid="selected-tone"]').should('contain', tone);
      });
      
      // Verify tone preview updates
      cy.get('[data-testid="tone-preview"]').should('be.visible');
    });

    it('should generate AI response with loading state', () => {
      // Click generate button
      cy.get('[data-testid="generate-button"]').click();
      
      // Verify loading indicator
      cy.get('[data-testid="generation-progress"]').should('be.visible');
      
      // Wait for response
      cy.wait('@generateResponse');
      
      // Verify content update
      cy.get('[data-testid="response-editor"]')
        .should('contain', 'Mock response content');
    });
  });

  describe('Response Preview Tests', () => {
    it('should display preview with correct formatting', () => {
      // Enter test content
      cy.get('[data-testid="response-editor"]').type('Test response content');
      
      // Switch to preview mode
      cy.get('[data-testid="preview-button"]').click();
      
      // Verify preview rendering
      cy.get('[data-testid="response-preview"]')
        .should('be.visible')
        .and('contain', 'Test response content');
        
      // Check metadata display
      cy.get('[data-testid="preview-metadata"]').within(() => {
        cy.get('[data-testid="word-count"]').should('be.visible');
        cy.get('[data-testid="tone-indicator"]').should('be.visible');
      });
    });

    it('should handle response workflow status changes', () => {
      // Test all status transitions
      Object.values(ResponseStatus).forEach(status => {
        cy.get('[data-testid="status-selector"]').click();
        cy.get(`[data-testid="status-option-${status}"]`).click();
        cy.get('[data-testid="current-status"]').should('contain', status);
      });
    });
  });

  describe('Template Management Tests', () => {
    it('should load and apply templates', () => {
      // Wait for templates to load
      cy.wait('@loadTemplates');
      
      // Open template selector
      cy.get('[data-testid="template-selector"]').click();
      
      // Verify template list
      cy.get('[data-testid="template-list"]')
        .should('be.visible')
        .within(() => {
          cy.get('[data-testid="template-item"]').should('have.length.gt', 0);
        });
        
      // Select and apply template
      cy.get('[data-testid="template-item"]').first().click();
      cy.get('[data-testid="apply-template"]').click();
      
      // Verify template content applied
      cy.get('[data-testid="response-editor"]')
        .should('not.be.empty');
    });

    it('should handle template search and filtering', () => {
      // Test search functionality
      cy.get('[data-testid="template-search"]')
        .type('professional');
        
      // Verify filtered results
      cy.get('[data-testid="template-item"]')
        .should('have.length.gt', 0)
        .and('contain', 'professional');
        
      // Test tone filter
      cy.get('[data-testid="template-tone-filter"]')
        .select(ResponseTone.PROFESSIONAL);
        
      // Verify filtered results
      cy.get('[data-testid="template-item"]')
        .should('have.attr', 'data-tone', ResponseTone.PROFESSIONAL);
    });
  });

  describe('Error Handling Tests', () => {
    it('should handle network failures gracefully', () => {
      // Simulate network failure
      cy.intercept('POST', '/api/v1/responses/generate', {
        statusCode: 500,
        body: { error: 'Internal Server Error' }
      }).as('failedGeneration');
      
      // Attempt generation
      cy.get('[data-testid="generate-button"]').click();
      
      // Verify error display
      cy.get('[data-testid="error-message"]')
        .should('be.visible')
        .and('contain', 'Error generating response');
        
      // Verify retry button
      cy.get('[data-testid="retry-button"]')
        .should('be.visible')
        .and('be.enabled');
    });

    it('should preserve editor state during errors', () => {
      // Enter test content
      const testContent = 'Test content preservation';
      cy.get('[data-testid="response-editor"]').type(testContent);
      
      // Simulate error
      cy.intercept('POST', '/api/v1/responses/generate', {
        statusCode: 500
      }).as('failedGeneration');
      
      // Attempt generation
      cy.get('[data-testid="generate-button"]').click();
      
      // Verify content preserved
      cy.get('[data-testid="response-editor"]')
        .should('contain', testContent);
    });
  });

  describe('Responsive Design Tests', () => {
    const viewports = [
      ['iphone-x', 375, 812],
      ['ipad-2', 768, 1024],
      ['macbook-15', 1440, 900]
    ];

    viewports.forEach(([device, width, height]) => {
      it(`should render correctly on ${device}`, () => {
        // Set viewport
        cy.viewport(width, height);
        
        // Verify responsive layout
        cy.get('[data-testid="response-container"]')
          .should('be.visible')
          .and('have.css', 'display', 'flex');
          
        // Check component visibility
        cy.get('[data-testid="response-editor"]').should('be.visible');
        cy.get('[data-testid="toolbar"]').should('be.visible');
        
        // Verify mobile adaptations if applicable
        if (width < 768) {
          cy.get('[data-testid="mobile-menu"]').should('be.visible');
        }
      });
    });
  });

  describe('Accessibility Tests', () => {
    it('should meet WCAG 2.1 Level AA standards', () => {
      // Check entire response page
      cy.checkA11y();
      
      // Check specific components
      cy.checkA11y('[data-testid="response-editor"]');
      cy.checkA11y('[data-testid="toolbar"]');
      cy.checkA11y('[data-testid="template-selector"]');
      
      // Verify keyboard navigation
      cy.get('[data-testid="response-editor"]').focus()
        .type('{tab}')
        .get('[data-testid="generate-button"]').should('have.focus');
    });
  });
});