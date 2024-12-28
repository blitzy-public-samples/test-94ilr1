/**
 * @fileoverview Comprehensive test suite for response-related React components
 * including accessibility testing, performance validation, and error handling.
 * @version 1.0.0
 */

import React from 'react'; // ^18.2.0
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'; // ^14.0.0
import { axe, toHaveNoViolations } from 'jest-axe'; // ^4.7.3
import { ThemeProvider } from '@mui/material/styles';
import { lightTheme, darkTheme } from '../../../src/styles/theme';

// Components under test
import ResponseEditor from '../../../src/components/response/ResponseEditor';
import ResponsePreview from '../../../src/components/response/ResponsePreview';
import ResponseTemplates from '../../../src/components/response/ResponseTemplates';

// Mock data and hooks
import { ResponseTone, ResponseStatus } from '../../../src/types/response.types';
import useResponse from '../../../src/hooks/useResponse';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock the useResponse hook
jest.mock('../../../src/hooks/useResponse');

// Mock data
const mockGeneratedResponse = {
  response_id: 'test-response-123',
  email_id: 'email-123',
  thread_id: 'thread-123',
  content: 'Test response content',
  template_id: 'template-123',
  tone: ResponseTone.PROFESSIONAL,
  status: ResponseStatus.PENDING_REVIEW,
  confidence_score: 0.95,
  generated_at: new Date(),
  metadata: {}
};

const mockTemplate = {
  template_id: 'template-123',
  name: 'Professional Response',
  content: 'Template content with {{variable}}',
  tone: ResponseTone.PROFESSIONAL,
  placeholders: ['variable'],
  tags: ['business', 'formal'],
  is_active: true,
  metadata: {}
};

describe('ResponseEditor Component', () => {
  beforeEach(() => {
    (useResponse as jest.Mock).mockReturnValue({
      generateResponse: jest.fn(),
      loadTemplates: jest.fn(),
      templates: [mockTemplate],
      loading: false,
      error: null
    });
  });

  it('renders without accessibility violations', async () => {
    const { container } = render(
      <ThemeProvider theme={lightTheme}>
        <ResponseEditor
          emailId="email-123"
          contextId="context-123"
          onSave={jest.fn()}
          onCancel={jest.fn()}
        />
      </ThemeProvider>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('handles template selection with keyboard navigation', async () => {
    const onSave = jest.fn();
    render(
      <ThemeProvider theme={lightTheme}>
        <ResponseEditor
          emailId="email-123"
          contextId="context-123"
          onSave={onSave}
          onCancel={jest.fn()}
        />
      </ThemeProvider>
    );

    const templateSelect = screen.getByLabelText(/select response template/i);
    fireEvent.keyDown(templateSelect, { key: 'Enter' });
    
    const option = screen.getByText(mockTemplate.name);
    fireEvent.click(option);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(mockTemplate.content);
    });
  });

  it('validates tone selection and updates content', async () => {
    const generateResponse = jest.fn().mockResolvedValue({
      data: mockGeneratedResponse
    });
    (useResponse as jest.Mock).mockReturnValue({
      generateResponse,
      loadTemplates: jest.fn(),
      templates: [mockTemplate],
      loading: false,
      error: null
    });

    render(
      <ThemeProvider theme={lightTheme}>
        <ResponseEditor
          emailId="email-123"
          contextId="context-123"
          onSave={jest.fn()}
          onCancel={jest.fn()}
        />
      </ThemeProvider>
    );

    const toneSelect = screen.getByLabelText(/select response tone/i);
    fireEvent.mouseDown(toneSelect);
    const friendlyOption = screen.getByText(/friendly/i);
    fireEvent.click(friendlyOption);

    await waitFor(() => {
      expect(generateResponse).toHaveBeenCalledWith(expect.objectContaining({
        preferred_tone: ResponseTone.FRIENDLY
      }));
    });
  });
});

describe('ResponsePreview Component', () => {
  const mockHandlers = {
    onEdit: jest.fn(),
    onApprove: jest.fn(),
    onReject: jest.fn()
  };

  it('renders response content with proper ARIA attributes', () => {
    render(
      <ThemeProvider theme={lightTheme}>
        <ResponsePreview
          response={mockGeneratedResponse}
          {...mockHandlers}
        />
      </ThemeProvider>
    );

    const preview = screen.getByRole('article');
    expect(preview).toHaveAttribute('aria-label', expect.stringContaining('Email Response Preview'));
    
    const content = screen.getByRole('textbox');
    expect(content).toHaveAttribute('aria-multiline', 'true');
  });

  it('handles action buttons with proper accessibility', async () => {
    render(
      <ThemeProvider theme={lightTheme}>
        <ResponsePreview
          response={mockGeneratedResponse}
          {...mockHandlers}
        />
      </ThemeProvider>
    );

    const editButton = screen.getByLabelText(/edit response/i);
    const approveButton = screen.getByLabelText(/approve response/i);
    const rejectButton = screen.getByLabelText(/reject response/i);

    fireEvent.click(editButton);
    expect(mockHandlers.onEdit).toHaveBeenCalledWith(mockGeneratedResponse);

    fireEvent.click(approveButton);
    expect(mockHandlers.onApprove).toHaveBeenCalledWith(mockGeneratedResponse);

    fireEvent.click(rejectButton);
    expect(mockHandlers.onReject).toHaveBeenCalledWith(mockGeneratedResponse);
  });
});

describe('ResponseTemplates Component', () => {
  beforeEach(() => {
    (useResponse as jest.Mock).mockReturnValue({
      loadTemplates: jest.fn(),
      templates: [mockTemplate],
      loading: false,
      error: null
    });
  });

  it('implements virtual scrolling for performance', async () => {
    const templates = Array.from({ length: 100 }, (_, i) => ({
      ...mockTemplate,
      template_id: `template-${i}`,
      name: `Template ${i}`
    }));

    (useResponse as jest.Mock).mockReturnValue({
      loadTemplates: jest.fn(),
      templates,
      loading: false,
      error: null
    });

    const { container } = render(
      <ThemeProvider theme={lightTheme}>
        <ResponseTemplates
          onTemplateSelect={jest.fn()}
          selectedTone={ResponseTone.PROFESSIONAL}
        />
      </ThemeProvider>
    );

    const virtualList = container.querySelector('[style*="transform"]');
    expect(virtualList).toBeInTheDocument();
  });

  it('supports keyboard navigation between templates', async () => {
    const onTemplateSelect = jest.fn();
    render(
      <ThemeProvider theme={lightTheme}>
        <ResponseTemplates
          onTemplateSelect={onTemplateSelect}
          selectedTone={ResponseTone.PROFESSIONAL}
          accessibility={{
            enableKeyboardNav: true,
            announceSelection: true,
            highContrast: false
          }}
        />
      </ThemeProvider>
    );

    const templateCard = screen.getByRole('button');
    fireEvent.keyPress(templateCard, { key: 'Enter' });

    await waitFor(() => {
      expect(onTemplateSelect).toHaveBeenCalledWith(mockTemplate);
    });
  });

  it('handles theme switching without accessibility violations', async () => {
    const { rerender, container } = render(
      <ThemeProvider theme={lightTheme}>
        <ResponseTemplates
          onTemplateSelect={jest.fn()}
          selectedTone={ResponseTone.PROFESSIONAL}
        />
      </ThemeProvider>
    );

    let results = await axe(container);
    expect(results).toHaveNoViolations();

    rerender(
      <ThemeProvider theme={darkTheme}>
        <ResponseTemplates
          onTemplateSelect={jest.fn()}
          selectedTone={ResponseTone.PROFESSIONAL}
        />
      </ThemeProvider>
    );

    results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});