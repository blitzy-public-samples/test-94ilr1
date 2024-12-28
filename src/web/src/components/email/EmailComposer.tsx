/**
 * @fileoverview EmailComposer Component
 * A comprehensive email composition component with rich text editing,
 * AI-powered suggestions, attachment handling, and accessibility features.
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react'; // ^18.2.0
import { Editor } from '@tinymce/tinymce-react'; // ^4.3.0
import { useTranslation } from 'react-i18next'; // ^13.0.0
import { 
  Box,
  TextField,
  Button,
  IconButton,
  Chip,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Paper
} from '@mui/material'; // ^5.14.0
import {
  AttachFile as AttachFileIcon,
  Send as SendIcon,
  Close as CloseIcon,
  LightbulbOutlined as SuggestIcon
} from '@mui/icons-material'; // ^5.14.0

import { IEmailMessage, EmailPriority } from '../../types/email.types';
import { useEmail } from '../../hooks/useEmail';

// Constants for validation and security
const MAX_RECIPIENTS = 50;
const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024; // 25MB
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png'
];

// Interface for component props
interface EmailComposerProps {
  replyTo?: IEmailMessage;
  onSend?: (email: IEmailMessage) => void;
  onCancel?: () => void;
  initialContext?: Record<string, unknown>;
}

/**
 * EmailComposer Component
 * Provides a rich interface for composing emails with AI assistance
 */
export const EmailComposer: React.FC<EmailComposerProps> = ({
  replyTo,
  onSend,
  onCancel,
  initialContext
}) => {
  const { t } = useTranslation();
  const { sendEmail, getAISuggestions } = useEmail();
  const editorRef = useRef<any>(null);

  // State management
  const [to, setTo] = useState<string[]>(replyTo?.toAddresses || []);
  const [cc, setCc] = useState<string[]>(replyTo?.ccAddresses || []);
  const [bcc, setBcc] = useState<string[]>(replyTo?.bccAddresses || []);
  const [subject, setSubject] = useState(replyTo ? `Re: ${replyTo.subject}` : '');
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [priority, setPriority] = useState<EmailPriority>(EmailPriority.NORMAL);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Email validation
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Attachment validation
  const validateAttachment = (file: File): boolean => {
    if (file.size > MAX_ATTACHMENT_SIZE) {
      setError(t('email.error.attachmentTooLarge'));
      return false;
    }
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      setError(t('email.error.invalidFileType'));
      return false;
    }
    return true;
  };

  // Handle file attachments
  const handleAttachment = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const validFiles = files.filter(validateAttachment);
    setAttachments(prev => [...prev, ...validFiles]);
  };

  // Remove attachment
  const handleRemoveAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // Handle AI suggestions
  const handleAISuggestions = useCallback(async () => {
    try {
      const currentContent = editorRef.current?.getContent();
      const suggestions = await getAISuggestions({
        content: currentContent,
        context: initialContext
      });
      setSuggestions(suggestions);
    } catch (error) {
      console.error('Error getting AI suggestions:', error);
      setError(t('email.error.aiSuggestionsFailed'));
    }
  }, [getAISuggestions, initialContext, t]);

  // Apply suggestion to content
  const applySuggestion = (suggestion: string) => {
    setContent(suggestion);
    setSuggestions([]);
  };

  // Validate form before submission
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (to.length === 0) {
      errors.to = t('email.error.recipientRequired');
    }
    if (!subject.trim()) {
      errors.subject = t('email.error.subjectRequired');
    }
    if (!content.trim()) {
      errors.content = t('email.error.contentRequired');
    }
    if ([...to, ...cc, ...bcc].length > MAX_RECIPIENTS) {
      errors.recipients = t('email.error.tooManyRecipients');
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const emailData: IEmailMessage = {
        toAddresses: to,
        ccAddresses: cc,
        bccAddresses: bcc,
        subject,
        content,
        attachments: attachments.map(file => ({
          filename: file.name,
          contentType: file.type,
          size: file.size
        })),
        priority
      };

      await sendEmail(emailData);
      onSend?.(emailData);
      
      // Clear form
      setTo([]);
      setCc([]);
      setBcc([]);
      setSubject('');
      setContent('');
      setAttachments([]);
      setPriority(EmailPriority.NORMAL);
      
    } catch (error) {
      console.error('Error sending email:', error);
      setError(t('email.error.sendFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Editor configuration
  const editorConfig = {
    height: 400,
    menubar: false,
    plugins: [
      'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
      'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
      'insertdatetime', 'media', 'table', 'code', 'help', 'wordcount'
    ],
    toolbar: 'undo redo | formatselect | bold italic backcolor | \
      alignleft aligncenter alignright alignjustify | \
      bullist numlist outdent indent | removeformat | help',
    content_style: 'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 14px }',
    accessibility_focus: true
  };

  return (
    <Paper elevation={2} sx={{ p: 3 }}>
      <Box component="form" onSubmit={handleSubmit} noValidate>
        {/* Recipients */}
        <TextField
          fullWidth
          label={t('email.to')}
          value={to.join('; ')}
          onChange={(e) => setTo(e.target.value.split(';').map(e => e.trim()))}
          error={!!validationErrors.to}
          helperText={validationErrors.to}
          margin="normal"
          required
        />

        <TextField
          fullWidth
          label={t('email.cc')}
          value={cc.join('; ')}
          onChange={(e) => setCc(e.target.value.split(';').map(e => e.trim()))}
          margin="normal"
        />

        <TextField
          fullWidth
          label={t('email.bcc')}
          value={bcc.join('; ')}
          onChange={(e) => setBcc(e.target.value.split(';').map(e => e.trim()))}
          margin="normal"
        />

        {/* Subject */}
        <TextField
          fullWidth
          label={t('email.subject')}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          error={!!validationErrors.subject}
          helperText={validationErrors.subject}
          margin="normal"
          required
        />

        {/* Priority Selection */}
        <FormControl fullWidth margin="normal">
          <InputLabel>{t('email.priority')}</InputLabel>
          <Select
            value={priority}
            onChange={(e) => setPriority(e.target.value as EmailPriority)}
          >
            <MenuItem value={EmailPriority.NORMAL}>{t('email.priority.normal')}</MenuItem>
            <MenuItem value={EmailPriority.HIGH}>{t('email.priority.high')}</MenuItem>
            <MenuItem value={EmailPriority.URGENT}>{t('email.priority.urgent')}</MenuItem>
          </Select>
        </FormControl>

        {/* Rich Text Editor */}
        <Box sx={{ mt: 2, mb: 2 }}>
          <Editor
            ref={editorRef}
            initialValue={content}
            init={editorConfig}
            onEditorChange={(content) => setContent(content)}
          />
          {validationErrors.content && (
            <Typography color="error" variant="caption">
              {validationErrors.content}
            </Typography>
          )}
        </Box>

        {/* AI Suggestions */}
        <Box sx={{ mb: 2 }}>
          <Button
            startIcon={<SuggestIcon />}
            onClick={handleAISuggestions}
            disabled={isSubmitting}
          >
            {t('email.getAISuggestions')}
          </Button>
          {suggestions.map((suggestion, index) => (
            <Chip
              key={index}
              label={suggestion.substring(0, 50) + '...'}
              onClick={() => applySuggestion(suggestion)}
              onDelete={() => setSuggestions(prev => prev.filter((_, i) => i !== index))}
              sx={{ m: 0.5 }}
            />
          ))}
        </Box>

        {/* Attachments */}
        <Box sx={{ mb: 2 }}>
          <input
            accept={ALLOWED_MIME_TYPES.join(',')}
            id="attachment-input"
            type="file"
            multiple
            onChange={handleAttachment}
            style={{ display: 'none' }}
          />
          <label htmlFor="attachment-input">
            <Button
              component="span"
              startIcon={<AttachFileIcon />}
              disabled={isSubmitting}
            >
              {t('email.attachFiles')}
            </Button>
          </label>
          <Box sx={{ mt: 1 }}>
            {attachments.map((file, index) => (
              <Chip
                key={index}
                label={file.name}
                onDelete={() => handleRemoveAttachment(index)}
                sx={{ m: 0.5 }}
              />
            ))}
          </Box>
        </Box>

        {/* Error Display */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Action Buttons */}
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
          <Button
            onClick={onCancel}
            disabled={isSubmitting}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            variant="contained"
            color="primary"
            startIcon={isSubmitting ? <CircularProgress size={20} /> : <SendIcon />}
            disabled={isSubmitting}
          >
            {t('email.send')}
          </Button>
        </Box>
      </Box>
    </Paper>
  );
};

export default EmailComposer;