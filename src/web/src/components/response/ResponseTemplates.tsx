/**
 * @fileoverview Enterprise-grade React component for displaying and managing email response templates
 * with advanced filtering, selection, preview capabilities, accessibility features, and performance optimizations.
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react'; // ^18.2.0
import { 
  Card, 
  CardContent, 
  Typography, 
  Grid, 
  Skeleton, 
  Modal,
  Box,
  IconButton,
  Chip,
  useTheme,
  Tooltip,
  CircularProgress
} from '@mui/material'; // ^5.14.0
import { useVirtualizer } from '@tanstack/react-virtual'; // ^2.10.4 (Updated from react-virtual for better performance)

// Internal imports
import { ResponseTemplate, ResponseTone } from '../../types/response.types';
import useResponse from '../../hooks/useResponse';

/**
 * Interface for accessibility configuration options
 */
interface AccessibilityConfig {
  announceSelection?: boolean;
  enableKeyboardNav?: boolean;
  highContrast?: boolean;
}

/**
 * Props interface for ResponseTemplates component
 */
interface ResponseTemplatesProps {
  onTemplateSelect: (template: ResponseTemplate) => void;
  selectedTone?: ResponseTone;
  tags?: string[];
  initialTemplate?: ResponseTemplate;
  accessibility?: AccessibilityConfig;
}

/**
 * Enhanced template card props interface
 */
interface TemplateCardProps {
  template: ResponseTemplate;
  isSelected: boolean;
  onSelect: (template: ResponseTemplate) => void;
  accessibility: AccessibilityConfig;
}

/**
 * Template card subcomponent with accessibility and performance optimizations
 */
const TemplateCard: React.FC<TemplateCardProps> = React.memo(({ 
  template, 
  isSelected, 
  onSelect, 
  accessibility 
}) => {
  const theme = useTheme();

  const handleKeyPress = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(template);
    }
  }, [template, onSelect]);

  return (
    <Card
      elevation={isSelected ? 3 : 1}
      sx={{
        cursor: 'pointer',
        border: isSelected ? `2px solid ${theme.palette.primary.main}` : 'none',
        backgroundColor: isSelected ? theme.palette.action.selected : theme.palette.background.paper,
        '&:hover': {
          backgroundColor: theme.palette.action.hover,
        },
        transition: 'all 0.2s ease-in-out'
      }}
      onClick={() => onSelect(template)}
      onKeyPress={handleKeyPress}
      tabIndex={0}
      role="button"
      aria-pressed={isSelected}
      aria-label={`Template: ${template.name}`}
    >
      <CardContent>
        <Typography 
          variant="h6" 
          component="h3"
          sx={{ mb: 1 }}
          color={accessibility.highContrast ? 'text.primary' : 'inherit'}
        >
          {template.name}
        </Typography>
        <Typography 
          variant="body2" 
          color="text.secondary"
          sx={{ mb: 2 }}
        >
          {template.content.substring(0, 100)}...
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {template.tags.map((tag) => (
            <Chip
              key={tag}
              label={tag}
              size="small"
              color={isSelected ? "primary" : "default"}
              sx={{ mr: 0.5, mb: 0.5 }}
            />
          ))}
        </Box>
      </CardContent>
    </Card>
  );
});

TemplateCard.displayName = 'TemplateCard';

/**
 * Main ResponseTemplates component with virtualization and accessibility features
 */
const ResponseTemplates: React.FC<ResponseTemplatesProps> = React.memo(({
  onTemplateSelect,
  selectedTone = ResponseTone.PROFESSIONAL,
  tags = [],
  initialTemplate,
  accessibility = {
    announceSelection: true,
    enableKeyboardNav: true,
    highContrast: false
  }
}) => {
  // Hooks
  const theme = useTheme();
  const { templates, loading, error, loadTemplates } = useResponse();
  
  // State
  const [selectedTemplate, setSelectedTemplate] = useState<ResponseTemplate | null>(
    initialTemplate || null
  );
  const [previewOpen, setPreviewOpen] = useState(false);

  // Memoized filtered templates
  const filteredTemplates = useMemo(() => {
    return templates.filter(template => {
      const toneMatch = !selectedTone || template.tone === selectedTone;
      const tagsMatch = tags.length === 0 || 
        tags.every(tag => template.tags.includes(tag));
      return toneMatch && tagsMatch && template.is_active;
    });
  }, [templates, selectedTone, tags]);

  // Virtual list configuration
  const parentRef = React.useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: filteredTemplates.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 200,
    overscan: 5
  });

  // Effects
  useEffect(() => {
    loadTemplates(selectedTone, tags);
  }, [loadTemplates, selectedTone, tags]);

  useEffect(() => {
    if (initialTemplate) {
      setSelectedTemplate(initialTemplate);
    }
  }, [initialTemplate]);

  // Handlers
  const handleTemplateSelect = useCallback((template: ResponseTemplate) => {
    if (!template.is_active) return;

    setSelectedTemplate(template);
    
    if (accessibility.announceSelection) {
      const announcement = `Selected template: ${template.name}`;
      window.speechSynthesis?.speak(new SpeechSynthesisUtterance(announcement));
    }

    onTemplateSelect(template);
  }, [onTemplateSelect, accessibility]);

  const handleKeyboardNavigation = useCallback((event: React.KeyboardEvent) => {
    if (!accessibility.enableKeyboardNav) return;

    const currentIndex = selectedTemplate 
      ? filteredTemplates.findIndex(t => t.template_id === selectedTemplate.template_id)
      : -1;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (currentIndex < filteredTemplates.length - 1) {
          handleTemplateSelect(filteredTemplates[currentIndex + 1]);
        }
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (currentIndex > 0) {
          handleTemplateSelect(filteredTemplates[currentIndex - 1]);
        }
        break;
    }
  }, [selectedTemplate, filteredTemplates, handleTemplateSelect, accessibility]);

  // Error handling
  if (error) {
    return (
      <Typography color="error" role="alert">
        Error loading templates: {error.message}
      </Typography>
    );
  }

  // Loading state
  if (loading) {
    return (
      <Grid container spacing={2}>
        {[...Array(6)].map((_, index) => (
          <Grid item xs={12} sm={6} md={4} key={index}>
            <Skeleton variant="rectangular" height={200} />
          </Grid>
        ))}
      </Grid>
    );
  }

  return (
    <Box
      ref={parentRef}
      sx={{
        height: '100%',
        overflow: 'auto',
        padding: theme.spacing(2)
      }}
      onKeyDown={handleKeyboardNavigation}
      role="listbox"
      aria-label="Response templates"
    >
      <Grid container spacing={2} sx={{ minHeight: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const template = filteredTemplates[virtualRow.index];
          return (
            <Grid
              item
              xs={12}
              sm={6}
              md={4}
              key={template.template_id}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: virtualRow.size,
                transform: `translateY(${virtualRow.start}px)`
              }}
            >
              <TemplateCard
                template={template}
                isSelected={selectedTemplate?.template_id === template.template_id}
                onSelect={handleTemplateSelect}
                accessibility={accessibility}
              />
            </Grid>
          );
        })}
      </Grid>

      {/* Template Preview Modal */}
      <Modal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        aria-labelledby="template-preview-title"
      >
        <Box sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 600,
          bgcolor: 'background.paper',
          boxShadow: 24,
          p: 4,
          borderRadius: 1
        }}>
          {selectedTemplate && (
            <>
              <Typography id="template-preview-title" variant="h6" component="h2">
                {selectedTemplate.name}
              </Typography>
              <Typography sx={{ mt: 2 }}>
                {selectedTemplate.content}
              </Typography>
            </>
          )}
        </Box>
      </Modal>
    </Box>
  );
});

ResponseTemplates.displayName = 'ResponseTemplates';

export default ResponseTemplates;