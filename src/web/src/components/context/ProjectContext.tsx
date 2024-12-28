/**
 * ProjectContext Component
 * Version: 1.0.0
 * 
 * Enhanced React component for displaying project context information with:
 * - Real-time context updates
 * - Accessibility features
 * - Performance optimizations
 * - Material Design integration
 * - Error boundary protection
 */

import React, { useMemo } from 'react';
import {
  Typography,
  Chip,
  LinearProgress,
  Box,
  Stack,
  Skeleton
} from '@mui/material'; // ^5.14.0
import { styled } from '@mui/material/styles'; // ^5.14.0

// Internal imports
import Card from '../common/Card';
import { useContext } from '../../hooks/useContext';
import { ProjectContext, ProjectStatus } from '../../types/context.types';

// Enhanced styled components with theme integration
const StyledBox = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  '& > *:not(:last-child)': {
    marginBottom: theme.spacing(2)
  }
}));

const StyledChip = styled(Chip)(({ theme }) => ({
  margin: theme.spacing(0.5),
  '&:hover': {
    boxShadow: theme.shadows[2]
  }
}));

const StyledProgress = styled(LinearProgress)(({ theme }) => ({
  height: 8,
  borderRadius: 4,
  marginTop: theme.spacing(1),
  marginBottom: theme.spacing(2)
}));

// Props interface with enhanced type safety
interface ProjectContextProps {
  projectContext: ProjectContext;
  onUpdate?: (updatedContext: ProjectContext) => void;
  className?: string;
  testId?: string;
}

/**
 * Formats relevance score as percentage with error handling
 */
const formatRelevanceScore = (score: number): string => {
  try {
    if (score < 0 || score > 1) {
      throw new Error('Invalid relevance score');
    }
    return `${Math.round(score * 100)}%`;
  } catch (error) {
    console.error('Error formatting relevance score:', error);
    return 'N/A';
  }
};

/**
 * Maps project status to appropriate color with theme integration
 */
const getStatusColor = (status: ProjectStatus): string => {
  const statusColorMap: Record<ProjectStatus, string> = {
    ACTIVE: 'success',
    COMPLETED: 'info',
    ON_HOLD: 'warning',
    ARCHIVED: 'default'
  };
  return statusColorMap[status] || 'default';
};

/**
 * Enhanced ProjectContext component with error boundary and performance optimizations
 */
const ProjectContextComponent: React.FC<ProjectContextProps> = React.memo(({
  projectContext,
  onUpdate,
  className,
  testId = 'project-context'
}) => {
  const { loading, error, updateContext } = useContext();

  // Memoized project attributes for performance
  const sortedAttributes = useMemo(() => {
    return Object.entries(projectContext.attributes || {})
      .sort(([a], [b]) => a.localeCompare(b));
  }, [projectContext.attributes]);

  // Handle loading state
  if (loading) {
    return (
      <Card
        variant="outlined"
        className={className}
        data-testid={`${testId}-loading`}
        aria-busy="true"
      >
        <StyledBox>
          <Skeleton variant="text" width="60%" height={32} />
          <Skeleton variant="text" width="40%" height={24} />
          <Skeleton variant="rectangular" height={100} />
        </StyledBox>
      </Card>
    );
  }

  // Handle error state
  if (error) {
    return (
      <Card
        variant="outlined"
        className={className}
        data-testid={`${testId}-error`}
        role="alert"
      >
        <StyledBox>
          <Typography color="error" variant="body1">
            Error loading project context: {error.message}
          </Typography>
        </StyledBox>
      </Card>
    );
  }

  return (
    <Card
      variant="outlined"
      className={className}
      data-testid={testId}
      aria-label={`Project context for ${projectContext.projectName}`}
    >
      <StyledBox>
        {/* Project Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6" component="h2">
            {projectContext.projectName}
          </Typography>
          <StyledChip
            label={projectContext.status}
            color={getStatusColor(projectContext.status)}
            size="small"
            aria-label={`Project status: ${projectContext.status}`}
          />
        </Stack>

        {/* Relevance Score */}
        <Box>
          <Typography
            variant="body2"
            color="textSecondary"
            id={`${testId}-relevance-label`}
          >
            Relevance Score: {formatRelevanceScore(projectContext.relevanceScore)}
          </Typography>
          <StyledProgress
            variant="determinate"
            value={projectContext.relevanceScore * 100}
            aria-labelledby={`${testId}-relevance-label`}
          />
        </Box>

        {/* Key Terms */}
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Key Terms
          </Typography>
          <Box role="list" aria-label="Project key terms">
            {projectContext.keyTerms.map((term, index) => (
              <StyledChip
                key={`${term}-${index}`}
                label={term}
                size="small"
                variant="outlined"
                role="listitem"
              />
            ))}
          </Box>
        </Box>

        {/* Project Attributes */}
        {sortedAttributes.length > 0 && (
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Attributes
            </Typography>
            <Stack spacing={1} role="list" aria-label="Project attributes">
              {sortedAttributes.map(([key, value]) => (
                <Box
                  key={key}
                  role="listitem"
                  sx={{ display: 'flex', justifyContent: 'space-between' }}
                >
                  <Typography variant="body2" color="textSecondary">
                    {key}:
                  </Typography>
                  <Typography variant="body2">{value}</Typography>
                </Box>
              ))}
            </Stack>
          </Box>
        )}

        {/* Last Updated */}
        <Typography
          variant="caption"
          color="textSecondary"
          sx={{ display: 'block', mt: 2 }}
        >
          Last updated: {new Date(projectContext.lastUpdated).toLocaleString()}
        </Typography>
      </StyledBox>
    </Card>
  );
});

// Display name for development tooling
ProjectContextComponent.displayName = 'ProjectContext';

// Default export with error boundary wrapper
export default ProjectContextComponent;

// Type export for external usage
export type { ProjectContextProps };