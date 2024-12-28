import React, { useCallback, useEffect, useState } from 'react';
import { Tooltip as MuiTooltip } from '@mui/material'; // v5.14.0
import { styled, useTheme } from '@mui/material/styles'; // v5.14.0
import { useMediaQuery } from '@mui/material'; // v5.14.0
import { lightTheme } from '../../styles/theme';

// Types and Interfaces
interface EnhancedTooltipProps {
  title: string | React.ReactNode;
  children: React.ReactNode;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  arrow?: boolean;
  enterDelay?: number;
  leaveDelay?: number;
  className?: string;
  contentType?: EmailContentType;
  richText?: boolean;
  themeMode?: 'light' | 'dark' | 'system';
  maxWidth?: number | string;
  onOpen?: (event: React.MouseEvent) => void;
  onClose?: (event: React.MouseEvent) => void;
  'aria-label'?: string;
  role?: string;
  tabIndex?: number;
}

interface EmailContentType {
  type: 'subject' | 'body' | 'attachment' | 'metadata';
  length: number;
  format: 'plain' | 'html' | 'markdown';
}

interface ViewportDimensions {
  width: number;
  height: number;
  scrollX: number;
  scrollY: number;
}

// Styled Components
const StyledTooltip = styled(MuiTooltip)(({ theme }) => ({
  '& .MuiTooltip-tooltip': {
    backgroundColor: theme.palette.mode === 'dark' 
      ? theme.palette.grey[900] 
      : theme.palette.grey[700],
    color: theme.palette.common.white,
    fontSize: theme.typography.emailMeta.fontSize,
    padding: theme.spacing(1.5, 2),
    maxWidth: 300,
    borderRadius: theme.spacing(1),
    boxShadow: theme.shadows[4],
    ...theme.typography.emailBody,
  },
  '& .MuiTooltip-arrow': {
    color: theme.palette.mode === 'dark' 
      ? theme.palette.grey[900] 
      : theme.palette.grey[700],
  },
}));

// Utility Functions
const getTooltipPlacement = (
  event: React.MouseEvent,
  elementRect: DOMRect,
  viewport: ViewportDimensions
): 'top' | 'bottom' | 'left' | 'right' => {
  const { clientX, clientY } = event;
  const { width, height } = elementRect;
  const { width: vWidth, height: vHeight } = viewport;

  const spaceTop = clientY;
  const spaceBottom = vHeight - clientY;
  const spaceLeft = clientX;
  const spaceRight = vWidth - clientX;

  const spaces = {
    top: spaceTop,
    bottom: spaceBottom,
    left: spaceLeft,
    right: spaceRight,
  };

  return Object.entries(spaces)
    .sort(([, a], [, b]) => b - a)[0][0] as 'top' | 'bottom' | 'left' | 'right';
};

// Custom Hook for Tooltip Content
const useTooltipContent = (
  contentId: string,
  options: { type: EmailContentType; richText: boolean }
) => {
  const [content, setContent] = useState<React.ReactNode | null>(null);

  useEffect(() => {
    const processContent = () => {
      // Process content based on type and format
      if (options.type.format === 'html' && options.richText) {
        return <div dangerouslySetInnerHTML={{ __html: contentId }} />;
      }
      return contentId;
    };

    setContent(processContent());
  }, [contentId, options]);

  return content;
};

// Main Component
export const Tooltip: React.FC<EnhancedTooltipProps> = ({
  title,
  children,
  placement = 'top',
  arrow = true,
  enterDelay = 200,
  leaveDelay = 0,
  className,
  contentType = { type: 'metadata', length: 0, format: 'plain' },
  richText = false,
  themeMode = 'system',
  maxWidth = 300,
  onOpen,
  onClose,
  'aria-label': ariaLabel,
  role = 'tooltip',
  tabIndex = 0,
  ...props
}) => {
  const theme = useTheme();
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  const [dynamicPlacement, setDynamicPlacement] = useState(placement);

  // Handle dynamic placement calculation
  const handlePlacementChange = useCallback((event: React.MouseEvent) => {
    const element = event.currentTarget.getBoundingClientRect();
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
    };
    
    setDynamicPlacement(getTooltipPlacement(event, element, viewport));
  }, []);

  // Process tooltip content
  const processedContent = useTooltipContent(title.toString(), {
    type: contentType,
    richText,
  });

  // Accessibility enhancements
  const tooltipProps = {
    'aria-label': ariaLabel || (typeof title === 'string' ? title : undefined),
    role,
    tabIndex,
    'aria-describedby': `tooltip-${contentType.type}`,
  };

  return (
    <StyledTooltip
      title={processedContent || title}
      placement={dynamicPlacement}
      arrow={arrow}
      enterDelay={enterDelay}
      leaveDelay={leaveDelay}
      className={className}
      onMouseEnter={handlePlacementChange}
      onFocus={handlePlacementChange}
      onOpen={onOpen}
      onClose={onClose}
      PopperProps={{
        sx: {
          maxWidth: maxWidth,
        },
      }}
      {...tooltipProps}
      {...props}
    >
      {React.cloneElement(children as React.ReactElement, {
        'aria-describedby': tooltipProps['aria-describedby'],
      })}
    </StyledTooltip>
  );
};

export type { EnhancedTooltipProps, EmailContentType };