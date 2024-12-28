/**
 * @fileoverview Enhanced Response Preview component with accessibility features,
 * Material Design 3.0 principles, and WCAG 2.1 Level AA compliance.
 * @version 1.0.0
 */

import React from 'react';
import { styled } from '@mui/material/styles';
import {
  Typography,
  Button,
  Chip,
  IconButton,
  LinearProgress,
  Alert,
  Skeleton,
  Box,
  Tooltip,
  useTheme
} from '@mui/material';
import {
  Edit as EditIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  ErrorOutline as ErrorIcon
} from '@mui/icons-material';
import { withErrorBoundary } from 'react-error-boundary';

import Card from '../common/Card';
import { useResponse } from '../../hooks/useResponse';
import { ResponseTone, ResponseStatus, GeneratedResponse } from '../../types/response.types';

// Styled components with enhanced accessibility
const PreviewContainer = styled(Box)(({ theme }) => ({
  position: 'relative',
  width: '100%',
  '& .MuiChip-root': {
    margin: theme.spacing(0.5),
  },
  '& .MuiLinearProgress-root': {
    marginTop: theme.spacing(2),
    borderRadius: theme.shape.borderRadius,
  },
}));

const ActionButtons = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(1),
  marginTop: theme.spacing(2),
  '& .MuiButton-root': {
    minWidth: 100,
  },
}));

// Props interface with comprehensive type safety
interface ResponsePreviewProps {
  response: GeneratedResponse;
  onEdit: (response: GeneratedResponse) => Promise<void>;
  onApprove: (response: GeneratedResponse) => Promise<void>;
  onReject: (response: GeneratedResponse) => Promise<void>;
  className?: string;
  ariaLabel?: string;
}

// Utility functions for semantic colors
const getToneColor = (tone: ResponseTone): string => {
  const toneColors = {
    [ResponseTone.PROFESSIONAL]: 'primary',
    [ResponseTone.FRIENDLY]: 'success',
    [ResponseTone.FORMAL]: 'info',
    [ResponseTone.CONCISE]: 'secondary',
  };
  return toneColors[tone] || 'default';
};

const getStatusColor = (status: ResponseStatus): string => {
  const statusColors = {
    [ResponseStatus.DRAFT]: 'default',
    [ResponseStatus.PENDING_REVIEW]: 'warning',
    [ResponseStatus.APPROVED]: 'success',
    [ResponseStatus.REJECTED]: 'error',
    [ResponseStatus.SENT]: 'info',
  };
  return statusColors[status] || 'default';
};

/**
 * Enhanced Response Preview component with comprehensive accessibility features
 */
const ResponsePreview = React.memo<ResponsePreviewProps>(({
  response,
  onEdit,
  onApprove,
  onReject,
  className = '',
  ariaLabel = 'Email Response Preview'
}) => {
  const theme = useTheme();
  const { loading, error } = useResponse();

  // Loading state with skeleton
  if (loading) {
    return (
      <Card aria-label="Loading response preview">
        <Skeleton variant="rectangular" height={200} />
        <Box sx={{ mt: 2 }}>
          <Skeleton variant="text" width="60%" />
          <Skeleton variant="text" width="40%" />
        </Box>
      </Card>
    );
  }

  // Error state with alert
  if (error) {
    return (
      <Alert
        severity="error"
        icon={<ErrorIcon />}
        action={
          <IconButton
            aria-label="close error"
            color="inherit"
            size="small"
            onClick={() => {/* Handle error dismissal */}}
          >
            <CloseIcon fontSize="inherit" />
          </IconButton>
        }
      >
        {error.message}
      </Alert>
    );
  }

  return (
    <Card
      className={className}
      aria-label={ariaLabel}
      role="article"
      focusable
    >
      <PreviewContainer>
        {/* Response metadata with semantic meaning */}
        <Box display="flex" flexWrap="wrap" gap={1} mb={2}>
          <Tooltip title={`Tone: ${response.tone}`}>
            <Chip
              label={response.tone}
              color={getToneColor(response.tone)}
              size="small"
              aria-label={`Response tone: ${response.tone}`}
            />
          </Tooltip>
          <Tooltip title={`Status: ${response.status}`}>
            <Chip
              label={response.status}
              color={getStatusColor(response.status)}
              size="small"
              aria-label={`Response status: ${response.status}`}
            />
          </Tooltip>
        </Box>

        {/* Response content with proper semantic structure */}
        <Typography
          variant="body1"
          component="div"
          sx={{ mb: 2 }}
          role="textbox"
          aria-multiline="true"
          aria-label="Response content"
        >
          {response.content}
        </Typography>

        {/* Confidence score indicator */}
        <Tooltip title={`Confidence Score: ${response.confidence_score * 100}%`}>
          <Box aria-label="Confidence score">
            <Typography variant="caption" color="textSecondary">
              Confidence Score
            </Typography>
            <LinearProgress
              variant="determinate"
              value={response.confidence_score * 100}
              sx={{
                height: 8,
                backgroundColor: theme.palette.grey[200],
              }}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={response.confidence_score * 100}
            />
          </Box>
        </Tooltip>

        {/* Action buttons with proper ARIA labels */}
        <ActionButtons>
          <Button
            startIcon={<EditIcon />}
            variant="outlined"
            onClick={() => onEdit(response)}
            aria-label="Edit response"
          >
            Edit
          </Button>
          <Button
            startIcon={<CheckIcon />}
            variant="contained"
            color="success"
            onClick={() => onApprove(response)}
            aria-label="Approve response"
          >
            Approve
          </Button>
          <Button
            startIcon={<CloseIcon />}
            variant="contained"
            color="error"
            onClick={() => onReject(response)}
            aria-label="Reject response"
          >
            Reject
          </Button>
        </ActionButtons>
      </PreviewContainer>
    </Card>
  );
});

// Display name for development tooling
ResponsePreview.displayName = 'ResponsePreview';

// Error boundary wrapper
const ResponsePreviewWithErrorBoundary = withErrorBoundary(ResponsePreview, {
  fallback: (
    <Alert severity="error">
      An error occurred while displaying the response preview.
    </Alert>
  ),
});

export default ResponsePreviewWithErrorBoundary;