/**
 * Enhanced Context Panel Component
 * Version: 1.0.0
 * 
 * A sophisticated sliding panel component for displaying email context information
 * with comprehensive error handling, accessibility features, and theme support.
 */

import React, { useEffect, useMemo, useCallback } from 'react'; // ^18.2.0
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  CircularProgress,
  Skeleton,
  useTheme,
  useMediaQuery,
  Alert,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Tooltip,
  Paper
} from '@mui/material'; // ^5.14.0
import {
  ChevronRight,
  ChevronLeft,
  ErrorOutline,
  Business,
  Person,
  Schedule,
  PriorityHigh
} from '@mui/icons-material'; // ^5.14.0
import { ErrorBoundary } from 'react-error-boundary'; // ^4.0.0

import { useContext } from '../../hooks/useContext';
import type { Context, ProjectContext, RelationshipContext } from '../../types/context.types';

/**
 * Props interface for the ContextPanel component
 */
interface ContextPanelProps {
  emailId: string | null;
  open: boolean;
  width?: number;
  onClose: () => void;
  onProjectClick?: (projectId: string) => void;
  onContactClick?: (contactId: string) => void;
  onError?: (error: Error) => void;
  ariaLabel?: string;
  className?: string;
}

/**
 * Error fallback component for error boundary
 */
const ErrorFallback: React.FC<{ error: Error; resetErrorBoundary: () => void }> = ({
  error,
  resetErrorBoundary
}) => (
  <Box p={2}>
    <Alert
      severity="error"
      action={
        <IconButton
          color="inherit"
          size="small"
          onClick={resetErrorBoundary}
          aria-label="Retry loading context"
        >
          <ErrorOutline />
        </IconButton>
      }
    >
      {error.message}
    </Alert>
  </Box>
);

/**
 * Loading skeleton component for context panel
 */
const ContextSkeleton: React.FC = () => (
  <Box p={2}>
    <Skeleton variant="rectangular" width="100%" height={60} sx={{ mb: 2 }} />
    <Skeleton variant="text" width="80%" />
    <Skeleton variant="text" width="60%" />
    <Skeleton variant="rectangular" width="100%" height={100} sx={{ mt: 2 }} />
  </Box>
);

/**
 * Enhanced Context Panel Component
 */
export const ContextPanel: React.FC<ContextPanelProps> = React.memo(({
  emailId,
  open,
  width = 320,
  onClose,
  onProjectClick,
  onContactClick,
  onError,
  ariaLabel = 'Context Panel',
  className
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const {
    context,
    loading,
    error,
    fetchContextByEmail
  } = useContext();

  // Calculate responsive width
  const drawerWidth = useMemo(() => {
    if (isMobile) return '100%';
    return typeof width === 'number' ? `${width}px` : width;
  }, [width, isMobile]);

  // Handle context fetching
  useEffect(() => {
    if (emailId && open) {
      fetchContextByEmail(emailId).catch((err) => {
        console.error('Failed to fetch context:', err);
        onError?.(err);
      });
    }
  }, [emailId, open, fetchContextByEmail, onError]);

  // Handle project click with accessibility
  const handleProjectClick = useCallback((projectId: string) => {
    onProjectClick?.(projectId);
  }, [onProjectClick]);

  // Handle contact click with accessibility
  const handleContactClick = useCallback((contactId: string) => {
    onContactClick?.(contactId);
  }, [onContactClick]);

  // Render project context section
  const renderProjectContext = useCallback((projects: ProjectContext[]) => (
    <Box component="section" aria-label="Project Context" mt={2}>
      <Typography variant="h6" gutterBottom>
        Project Context
      </Typography>
      <List>
        {projects.map((project) => (
          <ListItem
            key={project.projectId}
            button
            onClick={() => handleProjectClick(project.projectId)}
            aria-label={`Project: ${project.name}`}
          >
            <ListItemIcon>
              <Business />
            </ListItemIcon>
            <ListItemText
              primary={project.name}
              secondary={`Priority: ${project.priority}`}
            />
            {project.priority > 3 && (
              <Tooltip title="High Priority">
                <PriorityHigh color="error" />
              </Tooltip>
            )}
          </ListItem>
        ))}
      </List>
    </Box>
  ), [handleProjectClick]);

  // Render relationship context section
  const renderRelationshipContext = useCallback((relationships: RelationshipContext[]) => (
    <Box component="section" aria-label="Relationship Context" mt={2}>
      <Typography variant="h6" gutterBottom>
        Contact History
      </Typography>
      <List>
        {relationships.map((relation) => (
          <ListItem
            key={relation.contactId}
            button
            onClick={() => handleContactClick(relation.contactId)}
            aria-label={`Contact: ${relation.emailAddress}`}
          >
            <ListItemIcon>
              <Person />
            </ListItemIcon>
            <ListItemText
              primary={relation.emailAddress}
              secondary={`Last interaction: ${new Date(relation.lastInteractionAt).toLocaleDateString()}`}
            />
            <ListItemIcon>
              <Schedule />
            </ListItemIcon>
          </ListItem>
        ))}
      </List>
    </Box>
  ), [handleContactClick]);

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={onError}
      onReset={() => emailId && fetchContextByEmail(emailId)}
    >
      <Drawer
        anchor="right"
        open={open}
        onClose={onClose}
        variant="persistent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            backgroundColor: theme.palette.background.paper,
          },
        }}
        className={className}
        aria-label={ariaLabel}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            padding: theme.spacing(1),
            borderBottom: `1px solid ${theme.palette.divider}`,
          }}
        >
          <IconButton
            onClick={onClose}
            aria-label="Close context panel"
            edge="start"
          >
            {theme.direction === 'rtl' ? <ChevronLeft /> : <ChevronRight />}
          </IconButton>
          <Typography variant="h6" sx={{ ml: 2 }}>
            Context Details
          </Typography>
        </Box>

        <Box
          sx={{
            overflow: 'auto',
            height: '100%',
            padding: theme.spacing(2),
          }}
        >
          {loading && <ContextSkeleton />}
          
          {error && (
            <Alert
              severity="error"
              action={
                <IconButton
                  color="inherit"
                  size="small"
                  onClick={() => emailId && fetchContextByEmail(emailId)}
                  aria-label="Retry"
                >
                  <ErrorOutline />
                </IconButton>
              }
            >
              {error.message}
            </Alert>
          )}

          {context && !loading && !error && (
            <Paper elevation={0} sx={{ p: 2 }}>
              {context.projectContexts.length > 0 && (
                renderProjectContext(context.projectContexts)
              )}
              
              <Divider sx={{ my: 2 }} />
              
              {context.relationshipContexts.length > 0 && (
                renderRelationshipContext(context.relationshipContexts)
              )}

              <Box mt={2}>
                <Typography variant="subtitle2" color="textSecondary">
                  Last Updated: {new Date(context.analyzedAt).toLocaleString()}
                </Typography>
              </Box>
            </Paper>
          )}
        </Box>
      </Drawer>
    </ErrorBoundary>
  );
});

ContextPanel.displayName = 'ContextPanel';

export default ContextPanel;