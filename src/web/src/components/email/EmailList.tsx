/**
 * @fileoverview EmailList Component
 * A high-performance React component that renders a virtualized list of emails
 * with real-time updates, comprehensive accessibility features, and Material Design compliance.
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useRef, useState, memo } from 'react'; // v18.2+
import { List, CircularProgress, Alert, useTheme } from '@mui/material'; // v5.14+
import { AutoSizer, List as VirtualList, WindowScroller } from 'react-virtualized'; // v9.22+
import { styled } from '@mui/material/styles';

import { EmailListItem } from './EmailListItem';
import { IEmailMessage, EmailFilter } from '../../types/email.types';
import { useEmail } from '../../hooks/useEmail';
import { SortOrder } from '../../types/api.types';

// Enhanced props interface with comprehensive configuration options
interface EmailListProps {
  selectedEmailId: string | null;
  onEmailSelect: (email: IEmailMessage) => void;
  filter: EmailFilter;
  sortOrder: SortOrder;
  refreshInterval?: number;
  virtualizedConfig?: {
    overscanRowCount?: number;
    rowHeight?: number;
    threshold?: number;
  };
  accessibility?: {
    announceUpdates?: boolean;
    enableKeyboardNav?: boolean;
    ariaLabels?: {
      listLabel?: string;
      loadingText?: string;
      errorText?: string;
      noEmailsText?: string;
    };
  };
}

// Styled components with Material Design compliance
const StyledList = styled(List)(({ theme }) => ({
  width: '100%',
  height: '100%',
  overflowY: 'auto',
  backgroundColor: theme.palette.background.paper,
  position: 'relative',
  outline: 'none',
  scrollBehavior: 'smooth',
  '&[data-focus-visible]': {
    outline: `2px solid ${theme.palette.primary.main}`,
  },
  // High contrast mode support
  '@media (forced-colors: active)': {
    borderColor: 'CanvasText',
  },
  // Reduced motion support
  '@media (prefers-reduced-motion: reduce)': {
    scrollBehavior: 'auto',
  },
}));

/**
 * EmailList Component
 * Renders a virtualized list of emails with comprehensive features
 */
export const EmailList = memo<EmailListProps>(({
  selectedEmailId,
  onEmailSelect,
  filter,
  sortOrder,
  refreshInterval = 30000,
  virtualizedConfig = {
    overscanRowCount: 5,
    rowHeight: 72,
    threshold: 0.8,
  },
  accessibility = {
    announceUpdates: true,
    enableKeyboardNav: true,
    ariaLabels: {
      listLabel: 'Email list',
      loadingText: 'Loading emails',
      errorText: 'Error loading emails',
      noEmailsText: 'No emails found',
    },
  },
}) => {
  const theme = useTheme();
  const listRef = useRef<VirtualList | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const [isScrolling, setIsScrolling] = useState(false);

  // Initialize email hook with real-time updates
  const {
    emails,
    loading,
    error,
    fetchEmails,
    refreshEmails,
    clearError,
  } = useEmail({
    autoRefresh: true,
    refreshInterval,
    errorRetryCount: 3,
  });

  // Live region for accessibility announcements
  const liveRegionRef = useRef<HTMLDivElement>(null);

  // Announce updates to screen readers
  const announceUpdate = useCallback((message: string) => {
    if (accessibility.announceUpdates && liveRegionRef.current) {
      liveRegionRef.current.textContent = message;
    }
  }, [accessibility.announceUpdates]);

  // Initialize data fetching
  useEffect(() => {
    fetchEmails(filter);
  }, [fetchEmails, filter]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (!accessibility.enableKeyboardNav) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setFocusedIndex(prev => Math.min(prev + 1, emails.length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setFocusedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < emails.length) {
          onEmailSelect(emails[focusedIndex]);
        }
        break;
    }
  }, [accessibility.enableKeyboardNav, emails, focusedIndex, onEmailSelect]);

  // Row renderer for virtualized list
  const rowRenderer = useCallback(({
    index,
    key,
    style,
  }) => {
    const email = emails[index];
    if (!email) return null;

    return (
      <div key={key} style={style}>
        <EmailListItem
          email={email}
          onClick={onEmailSelect}
          selected={email.messageId === selectedEmailId}
          focused={index === focusedIndex}
          ariaLabel={`Email ${index + 1} of ${emails.length}`}
        />
      </div>
    );
  }, [emails, selectedEmailId, focusedIndex, onEmailSelect]);

  // Handle scroll events for infinite loading
  const handleScroll = useCallback(({
    scrollTop,
    scrollHeight,
    clientHeight,
  }) => {
    const scrollPosition = scrollTop / (scrollHeight - clientHeight);
    if (scrollPosition > virtualizedConfig.threshold && !loading && !error) {
      fetchEmails(filter);
    }
  }, [fetchEmails, filter, loading, error, virtualizedConfig.threshold]);

  // Render loading state
  if (loading && !emails.length) {
    return (
      <div
        role="alert"
        aria-busy="true"
        aria-label={accessibility.ariaLabels?.loadingText}
      >
        <CircularProgress />
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <Alert 
        severity="error"
        onClose={clearError}
        role="alert"
      >
        {accessibility.ariaLabels?.errorText}: {error}
      </Alert>
    );
  }

  // Render empty state
  if (!emails.length) {
    return (
      <div
        role="alert"
        aria-label={accessibility.ariaLabels?.noEmailsText}
      >
        {accessibility.ariaLabels?.noEmailsText}
      </div>
    );
  }

  return (
    <>
      {/* Live region for screen reader announcements */}
      <div
        ref={liveRegionRef}
        role="status"
        aria-live="polite"
        className="sr-only"
      />

      <StyledList
        component="div"
        role="list"
        aria-label={accessibility.ariaLabels?.listLabel}
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        <WindowScroller>
          {({ height, isScrolling: windowScrolling, scrollTop }) => (
            <AutoSizer disableHeight>
              {({ width }) => (
                <VirtualList
                  ref={listRef}
                  autoHeight
                  height={height}
                  width={width}
                  rowCount={emails.length}
                  rowHeight={virtualizedConfig.rowHeight}
                  rowRenderer={rowRenderer}
                  overscanRowCount={virtualizedConfig.overscanRowCount}
                  scrollTop={scrollTop}
                  onScroll={handleScroll}
                  isScrolling={windowScrolling}
                  aria-busy={loading}
                />
              )}
            </AutoSizer>
          )}
        </WindowScroller>
      </StyledList>
    </>
  );
});

// Display name for debugging
EmailList.displayName = 'EmailList';

export type { EmailListProps };