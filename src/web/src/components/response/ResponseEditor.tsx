/**
 * @fileoverview Rich text editor component for composing and editing email responses
 * with AI-assisted generation, template selection, and tone control.
 * Implements Material Design 3.0 principles and comprehensive accessibility features.
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react'; // ^18.2.0
import { Editor } from '@tinymce/tinymce-react'; // ^4.3.0
import {
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Alert,
  styled
} from '@mui/material'; // ^5.14.0

import useResponse from '../../hooks/useResponse';
import {
  ResponseTemplate,
  GeneratedResponse,
  ResponseTone,
  ResponseError
} from '../../types/response.types';
import TextField from '../common/TextField';

// Styled components following Material Design 3.0
const EditorContainer = styled('div')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
  padding: theme.spacing(2),
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
  boxShadow: theme.shadows[1],
  '& .tox-tinymce': {
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${theme.palette.divider}`,
  },
  '& .tox-editor-container': {
    backgroundColor: theme.palette.background.paper,
  }
}));

const ControlsContainer = styled('div')(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(2),
  marginBottom: theme.spacing(2),
  [theme.breakpoints.down('sm')]: {
    flexDirection: 'column',
  }
}));

// Props interface with enhanced accessibility support
interface ResponseEditorProps {
  emailId: string;
  contextId: string;
  initialContent?: string;
  onSave: (content: string) => void;
  onCancel: () => void;
  onError?: (error: ResponseError) => void;
}

/**
 * ResponseEditor component for composing and editing email responses
 * with AI assistance and accessibility features
 */
export const ResponseEditor: React.FC<ResponseEditorProps> = ({
  emailId,
  contextId,
  initialContent = '',
  onSave,
  onCancel,
  onError
}) => {
  // State management
  const [editorContent, setEditorContent] = useState(initialContent);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [selectedTone, setSelectedTone] = useState<ResponseTone>(ResponseTone.PROFESSIONAL);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Custom hook for response operations
  const {
    generateResponse,
    loadTemplates,
    templates,
    loading,
    error: responseError
  } = useResponse();

  // Refs for debouncing
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const editorRef = useRef<any>(null);

  // Load templates on mount
  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // Handle template selection change
  const handleTemplateChange = useCallback(async (event: React.ChangeEvent<{ value: unknown }>) => {
    const templateId = event.target.value as string;
    setSelectedTemplate(templateId);

    const template = templates.find(t => t.template_id === templateId);
    if (template) {
      setEditorContent(template.content);
      onSave(template.content);
    }
  }, [templates, onSave]);

  // Handle tone selection change
  const handleToneChange = useCallback(async (event: React.ChangeEvent<{ value: unknown }>) => {
    const tone = event.target.value as ResponseTone;
    setSelectedTone(tone);
    setSuccessMessage('Tone updated. Regenerating response...');

    try {
      setIsGenerating(true);
      const response = await generateResponse({
        email_id: emailId,
        context_id: contextId,
        preferred_tone: tone,
        template_id: selectedTemplate
      });

      if (response.data) {
        setEditorContent(response.data.content);
        onSave(response.data.content);
        setSuccessMessage('Response regenerated successfully');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to regenerate response';
      setError(errorMessage);
      onError?.(error as ResponseError);
    } finally {
      setIsGenerating(false);
    }
  }, [emailId, contextId, selectedTemplate, generateResponse, onSave, onError]);

  // Handle editor content changes with debouncing
  const handleEditorChange = useCallback((content: string) => {
    setEditorContent(content);

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      onSave(content);
    }, 500);
  }, [onSave]);

  // Generate AI response
  const generateAIResponse = useCallback(async () => {
    try {
      setIsGenerating(true);
      setError(null);

      const response = await generateResponse({
        email_id: emailId,
        context_id: contextId,
        preferred_tone: selectedTone,
        template_id: selectedTemplate
      });

      if (response.data) {
        setEditorContent(response.data.content);
        onSave(response.data.content);
        setSuccessMessage('AI response generated successfully');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate AI response';
      setError(errorMessage);
      onError?.(error as ResponseError);
    } finally {
      setIsGenerating(false);
    }
  }, [emailId, contextId, selectedTone, selectedTemplate, generateResponse, onSave, onError]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return (
    <EditorContainer>
      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      
      {successMessage && (
        <Alert severity="success" onClose={() => setSuccessMessage(null)}>
          {successMessage}
        </Alert>
      )}

      <ControlsContainer>
        <FormControl fullWidth>
          <InputLabel id="template-select-label">Template</InputLabel>
          <Select
            labelId="template-select-label"
            value={selectedTemplate}
            onChange={handleTemplateChange}
            disabled={loading.loadingTemplates || isGenerating}
            aria-label="Select response template"
          >
            <MenuItem value="">
              <em>None</em>
            </MenuItem>
            {templates.map((template) => (
              <MenuItem 
                key={template.template_id} 
                value={template.template_id}
              >
                {template.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth>
          <InputLabel id="tone-select-label">Tone</InputLabel>
          <Select
            labelId="tone-select-label"
            value={selectedTone}
            onChange={handleToneChange}
            disabled={isGenerating}
            aria-label="Select response tone"
          >
            {Object.values(ResponseTone).map((tone) => (
              <MenuItem key={tone} value={tone}>
                {tone.charAt(0) + tone.slice(1).toLowerCase()}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </ControlsContainer>

      <Editor
        ref={editorRef}
        apiKey={process.env.REACT_APP_TINYMCE_API_KEY}
        value={editorContent}
        onEditorChange={handleEditorChange}
        init={{
          height: 400,
          menubar: false,
          plugins: [
            'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
            'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
            'insertdatetime', 'media', 'table', 'help', 'wordcount'
          ],
          toolbar: 'undo redo | formatselect | bold italic | ' +
            'alignleft aligncenter alignright alignjustify | ' +
            'bullist numlist outdent indent | help',
          content_style: 'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 14px }',
          a11y_advanced_options: true,
          accessibility_focus: true
        }}
        disabled={isGenerating}
      />

      <ControlsContainer>
        <button
          onClick={generateAIResponse}
          disabled={isGenerating}
          aria-label="Generate AI response"
        >
          {isGenerating ? (
            <>
              <CircularProgress size={20} />
              Generating...
            </>
          ) : (
            'Generate AI Response'
          )}
        </button>
        <button onClick={onCancel} disabled={isGenerating}>
          Cancel
        </button>
      </ControlsContainer>
    </EditorContainer>
  );
};

export default ResponseEditor;