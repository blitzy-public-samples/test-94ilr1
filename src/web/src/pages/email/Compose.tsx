import React, { useCallback, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  TextField,
  Button,
  CircularProgress,
  Typography,
  Snackbar,
  Alert,
  Divider,
  IconButton,
} from '@mui/material';
import { useDropzone } from 'react-dropzone';
import { RichTextEditor } from '@company/rich-text-editor';
import { EmailService } from '@company/email-service';
import { AIResponseGenerator } from '@company/ai-service';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import DeleteIcon from '@mui/icons-material/Delete';
import LightbulbIcon from '@mui/icons-material/Lightbulb';

interface IEmailMessage {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  content: string;
  attachments: IAttachment[];
}

interface IAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  file: File;
}

interface ISuggestion {
  id: string;
  text: string;
  confidence: number;
}

const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024; // 25MB
const AUTO_SAVE_INTERVAL = 30000; // 30 seconds

const ComposePage: React.FC = React.memo(() => {
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailData, setEmailData] = useState<IEmailMessage>({
    to: [],
    cc: [],
    bcc: [],
    subject: '',
    content: '',
    attachments: [],
  });
  const [suggestions, setSuggestions] = useState<ISuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [autoSaveId, setAutoSaveId] = useState<string | null>(null);

  // Initialize with reply data if present
  useEffect(() => {
    const replyData = location.state?.replyTo;
    if (replyData) {
      setEmailData(prev => ({
        ...prev,
        to: [replyData.from],
        subject: `Re: ${replyData.subject}`,
        content: `\n\n> On ${new Date(replyData.date).toLocaleString()}, ${replyData.from} wrote:\n> ${replyData.content}`,
      }));
    }
  }, [location.state]);

  // Auto-save functionality
  useEffect(() => {
    const saveTimer = setInterval(async () => {
      if (emailData.subject || emailData.content) {
        try {
          const savedId = await EmailService.saveDraft(emailData);
          setAutoSaveId(savedId);
        } catch (err) {
          console.error('Auto-save failed:', err);
        }
      }
    }, AUTO_SAVE_INTERVAL);

    return () => clearInterval(saveTimer);
  }, [emailData]);

  // File upload handling
  const { getRootProps, getInputProps } = useDropzone({
    onDrop: useCallback(async (acceptedFiles: File[]) => {
      try {
        const processedAttachments = await handleAttachments(acceptedFiles);
        setEmailData(prev => ({
          ...prev,
          attachments: [...prev.attachments, ...processedAttachments],
        }));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to process attachments');
      }
    }, []),
    maxSize: MAX_ATTACHMENT_SIZE,
  });

  const handleAttachments = async (files: File[]): Promise<IAttachment[]> => {
    return files.map(file => ({
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      type: file.type,
      file,
    }));
  };

  const handleRemoveAttachment = (id: string) => {
    setEmailData(prev => ({
      ...prev,
      attachments: prev.attachments.filter(att => att.id !== id),
    }));
  };

  const handleAISuggestions = async (currentContent: string) => {
    try {
      setLoading(true);
      const suggestions = await AIResponseGenerator.generateSuggestions({
        content: currentContent,
        context: location.state?.context,
      });
      setSuggestions(suggestions);
      setShowSuggestions(true);
    } catch (err) {
      setError('Failed to generate AI suggestions');
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    try {
      setLoading(true);
      await EmailService.sendEmail(emailData);
      navigate('/inbox', { state: { message: 'Email sent successfully' } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send email');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (autoSaveId) {
      EmailService.saveDraft(emailData); // Save one last time
    }
    navigate(-1);
  };

  return (
    <Box sx={{ p: 3, maxWidth: '1200px', margin: '0 auto' }}>
      <Paper elevation={2} sx={{ p: 3 }}>
        <Box sx={{ mb: 3 }}>
          <TextField
            fullWidth
            label="To"
            value={emailData.to.join('; ')}
            onChange={(e) => setEmailData(prev => ({
              ...prev,
              to: e.target.value.split(';').map(email => email.trim()),
            }))}
            margin="normal"
          />
          <TextField
            fullWidth
            label="CC"
            value={emailData.cc?.join('; ')}
            onChange={(e) => setEmailData(prev => ({
              ...prev,
              cc: e.target.value.split(';').map(email => email.trim()),
            }))}
            margin="normal"
          />
          <TextField
            fullWidth
            label="Subject"
            value={emailData.subject}
            onChange={(e) => setEmailData(prev => ({
              ...prev,
              subject: e.target.value,
            }))}
            margin="normal"
          />
        </Box>

        <Divider sx={{ mb: 2 }} />

        <RichTextEditor
          value={emailData.content}
          onChange={(content) => setEmailData(prev => ({ ...prev, content }))}
          onBlur={() => handleAISuggestions(emailData.content)}
        />

        <Box sx={{ mt: 2, mb: 2 }}>
          <div {...getRootProps()} style={{ border: '2px dashed #ccc', padding: '20px', textAlign: 'center' }}>
            <input {...getInputProps()} />
            <AttachFileIcon />
            <Typography>Drag & drop files here, or click to select files</Typography>
          </div>

          {emailData.attachments.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2">Attachments:</Typography>
              {emailData.attachments.map(att => (
                <Box key={att.id} sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                  <AttachFileIcon sx={{ mr: 1 }} />
                  <Typography>{att.name} ({(att.size / 1024 / 1024).toFixed(2)}MB)</Typography>
                  <IconButton onClick={() => handleRemoveAttachment(att.id)} size="small">
                    <DeleteIcon />
                  </IconButton>
                </Box>
              ))}
            </Box>
          )}
        </Box>

        {showSuggestions && suggestions.length > 0 && (
          <Paper sx={{ p: 2, mb: 2, bgcolor: '#f5f5f5' }}>
            <Typography variant="subtitle1" sx={{ display: 'flex', alignItems: 'center' }}>
              <LightbulbIcon sx={{ mr: 1 }} />
              AI Suggestions
            </Typography>
            {suggestions.map(suggestion => (
              <Button
                key={suggestion.id}
                variant="text"
                size="small"
                onClick={() => setEmailData(prev => ({
                  ...prev,
                  content: suggestion.text,
                }))}
                sx={{ mr: 1, mt: 1 }}
              >
                Apply Suggestion
              </Button>
            ))}
          </Paper>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 3 }}>
          <Button variant="outlined" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSend}
            disabled={loading || !emailData.to.length || !emailData.subject}
          >
            {loading ? <CircularProgress size={24} /> : 'Send'}
          </Button>
        </Box>
      </Paper>

      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
      >
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
});

ComposePage.displayName = 'ComposePage';

export default ComposePage;