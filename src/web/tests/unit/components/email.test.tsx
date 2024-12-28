/**
 * @fileoverview Comprehensive test suite for email-related React components
 * Testing functionality, accessibility, and visual compliance with Material Design 3.0
 * @version 1.0.0
 */

import React from 'react'; // v18.2+
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'; // v14.0+
import userEvent from '@testing-library/user-event'; // v14.0+
import { vi, describe, it, expect, beforeEach } from 'vitest'; // v0.34+
import { axe, toHaveNoViolations } from 'jest-axe'; // v4.7+

import { EmailList } from '../../../src/components/email/EmailList';
import EmailViewer from '../../../src/components/email/EmailViewer';
import { EmailComposer } from '../../../src/components/email/EmailComposer';
import { EmailPriority, EmailStatus } from '../../../src/types/email.types';

// Mock dependencies
vi.mock('../../../src/hooks/useEmail', () => ({
  useEmail: () => ({
    emails: mockEmails,
    loading: false,
    error: null,
    fetchEmails: vi.fn(),
    refreshEmails: vi.fn(),
    clearError: vi.fn(),
    sendEmail: vi.fn(),
    getAISuggestions: vi.fn()
  })
}));

// Test data
const mockEmails = [
  {
    messageId: '1',
    threadId: 'thread1',
    subject: 'Test Email 1',
    fromAddress: 'sender@test.com',
    toAddresses: ['recipient@test.com'],
    content: 'Test content 1',
    status: EmailStatus.UNREAD,
    priority: EmailPriority.NORMAL,
    receivedAt: new Date(),
    attachments: []
  },
  {
    messageId: '2',
    threadId: 'thread2',
    subject: 'Test Email 2',
    fromAddress: 'sender2@test.com',
    toAddresses: ['recipient2@test.com'],
    content: 'Test content 2',
    status: EmailStatus.READ,
    priority: EmailPriority.HIGH,
    receivedAt: new Date(),
    attachments: [
      {
        attachmentId: '1',
        filename: 'test.pdf',
        contentType: 'application/pdf',
        size: 1024,
        url: 'test.pdf'
      }
    ]
  }
];

// Custom render function with providers
const renderWithProviders = (ui: React.ReactElement) => {
  return render(ui, {
    wrapper: ({ children }) => (
      <div>{children}</div>
    )
  });
};

describe('EmailList Component', () => {
  const defaultProps = {
    selectedEmailId: null,
    onEmailSelect: vi.fn(),
    filter: {},
    sortOrder: 'desc'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders email list with correct items', () => {
    renderWithProviders(<EmailList {...defaultProps} />);
    
    expect(screen.getByRole('list')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(mockEmails.length);
  });

  it('handles email selection correctly', async () => {
    const onEmailSelect = vi.fn();
    renderWithProviders(
      <EmailList {...defaultProps} onEmailSelect={onEmailSelect} />
    );

    const firstEmail = screen.getAllByRole('listitem')[0];
    await userEvent.click(firstEmail);

    expect(onEmailSelect).toHaveBeenCalledWith(mockEmails[0]);
  });

  it('supports keyboard navigation', async () => {
    renderWithProviders(<EmailList {...defaultProps} />);
    
    const list = screen.getByRole('list');
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    
    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('meets accessibility requirements', async () => {
    const { container } = renderWithProviders(<EmailList {...defaultProps} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('handles loading state correctly', () => {
    vi.mocked(useEmail).mockImplementation(() => ({
      ...vi.mocked(useEmail)(),
      loading: true
    }));

    renderWithProviders(<EmailList {...defaultProps} />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });
});

describe('EmailViewer Component', () => {
  const defaultProps = {
    messageId: '1',
    onReply: vi.fn(),
    onForward: vi.fn()
  };

  it('renders email content correctly', () => {
    renderWithProviders(<EmailViewer {...defaultProps} />);
    
    expect(screen.getByRole('article')).toBeInTheDocument();
    expect(screen.getByText(mockEmails[0].subject)).toBeInTheDocument();
  });

  it('displays attachments when present', () => {
    renderWithProviders(
      <EmailViewer messageId="2" onReply={vi.fn()} onForward={vi.fn()} />
    );

    expect(screen.getByText('test.pdf')).toBeInTheDocument();
  });

  it('handles content sanitization', () => {
    const emailWithHtml = {
      ...mockEmails[0],
      content: '<script>alert("xss")</script><p>Safe content</p>'
    };

    vi.mocked(useEmail).mockImplementation(() => ({
      ...vi.mocked(useEmail)(),
      currentEmail: emailWithHtml
    }));

    renderWithProviders(<EmailViewer {...defaultProps} />);
    
    expect(screen.queryByText('alert("xss")')).not.toBeInTheDocument();
    expect(screen.getByText('Safe content')).toBeInTheDocument();
  });

  it('meets accessibility requirements', async () => {
    const { container } = renderWithProviders(<EmailViewer {...defaultProps} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe('EmailComposer Component', () => {
  const defaultProps = {
    onSend: vi.fn(),
    onCancel: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders form fields correctly', () => {
    renderWithProviders(<EmailComposer {...defaultProps} />);
    
    expect(screen.getByLabelText(/to/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/subject/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/priority/i)).toBeInTheDocument();
  });

  it('validates required fields', async () => {
    renderWithProviders(<EmailComposer {...defaultProps} />);
    
    const sendButton = screen.getByRole('button', { name: /send/i });
    await userEvent.click(sendButton);

    expect(screen.getByText(/recipient required/i)).toBeInTheDocument();
    expect(screen.getByText(/subject required/i)).toBeInTheDocument();
  });

  it('handles file attachments correctly', async () => {
    renderWithProviders(<EmailComposer {...defaultProps} />);
    
    const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
    const input = screen.getByLabelText(/attach files/i);
    
    await userEvent.upload(input, file);
    
    expect(screen.getByText('test.pdf')).toBeInTheDocument();
  });

  it('supports AI suggestions', async () => {
    const mockSuggestions = ['Suggested response 1', 'Suggested response 2'];
    vi.mocked(useEmail).mockImplementation(() => ({
      ...vi.mocked(useEmail)(),
      getAISuggestions: vi.fn().mockResolvedValue(mockSuggestions)
    }));

    renderWithProviders(<EmailComposer {...defaultProps} />);
    
    const suggestButton = screen.getByRole('button', { name: /get ai suggestions/i });
    await userEvent.click(suggestButton);

    await waitFor(() => {
      expect(screen.getByText(/Suggested response 1/)).toBeInTheDocument();
    });
  });

  it('meets accessibility requirements', async () => {
    const { container } = renderWithProviders(<EmailComposer {...defaultProps} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('handles form submission correctly', async () => {
    const onSend = vi.fn();
    renderWithProviders(<EmailComposer {...defaultProps} onSend={onSend} />);
    
    // Fill required fields
    await userEvent.type(screen.getByLabelText(/to/i), 'test@example.com');
    await userEvent.type(screen.getByLabelText(/subject/i), 'Test Subject');
    
    // Submit form
    const sendButton = screen.getByRole('button', { name: /send/i });
    await userEvent.click(sendButton);

    expect(onSend).toHaveBeenCalled();
  });
});