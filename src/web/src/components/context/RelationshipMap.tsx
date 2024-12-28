/**
 * RelationshipMap Component
 * Version: 1.0.0
 * 
 * A high-performance, accessible visualization component for email communication relationships
 * using force-directed graph layout with WebGL rendering.
 */

import React, { useMemo, useCallback, useRef, useEffect } from 'react';
import ForceGraph2D from 'react-force-graph'; // ^1.44.0
import { Box, Typography, Tooltip, CircularProgress, Alert } from '@mui/material'; // ^5.14.0
import { useTheme } from '@mui/material/styles';
import Card from '../common/Card';
import { RelationshipContext, RelationshipType } from '../../types/context.types';
import { useContext } from '../../hooks/useContext';

// Enhanced node structure with accessibility and styling
interface GraphNode {
  id: string;
  name: string;
  type: RelationshipType;
  value: number;
  color: string;
  ariaLabel: string;
  metrics: Record<string, number>;
}

// Enhanced link structure with relationship metadata
interface GraphLink {
  source: string;
  target: string;
  value: number;
  color: string;
}

// Comprehensive props interface with accessibility support
interface RelationshipMapProps {
  relationships: RelationshipContext[];
  width?: number | 'auto';
  height?: number;
  onNodeClick?: (node: RelationshipContext) => void;
  onError?: (error: Error) => void;
  className?: string;
  ariaLabel?: string;
}

// Color mapping for relationship types
const typeColors = {
  [RelationshipType.TEAM_MEMBER]: '#4CAF50',
  [RelationshipType.STAKEHOLDER]: '#2196F3',
  [RelationshipType.CLIENT]: '#FFC107',
  [RelationshipType.VENDOR]: '#9C27B0'
};

/**
 * Optimized data transformation with caching
 */
const prepareGraphData = (relationships: RelationshipContext[]) => {
  return useMemo(() => {
    try {
      const nodes: GraphNode[] = relationships.map(rel => ({
        id: rel.contactId,
        name: rel.emailAddress,
        type: rel.relationshipType,
        value: rel.interactionFrequency,
        color: typeColors[rel.relationshipType],
        ariaLabel: `${rel.emailAddress} - ${rel.relationshipType}`,
        metrics: rel.sentimentMetrics || {}
      }));

      // Create optimized links based on interaction patterns
      const links: GraphLink[] = relationships.reduce((acc: GraphLink[], rel) => {
        const otherNodes = relationships.filter(r => r.contactId !== rel.contactId);
        
        otherNodes.forEach(other => {
          if (rel.interactionFrequency > 0) {
            acc.push({
              source: rel.contactId,
              target: other.contactId,
              value: Math.min(rel.interactionFrequency, other.interactionFrequency),
              color: 'rgba(150,150,150,0.2)'
            });
          }
        });

        return acc;
      }, []);

      return { nodes, links };
    } catch (error) {
      console.error('Error preparing graph data:', error);
      throw new Error('Failed to prepare relationship graph data');
    }
  }, [relationships]);
};

/**
 * Enhanced RelationshipMap component with accessibility and performance optimizations
 */
const RelationshipMap: React.FC<RelationshipMapProps> = React.memo(({
  relationships,
  width = 'auto',
  height = 600,
  onNodeClick,
  onError,
  className,
  ariaLabel = 'Email relationship visualization'
}) => {
  const theme = useTheme();
  const graphRef = useRef<any>(null);
  const { loading, error } = useContext();

  // Prepare optimized graph data with error boundary
  const graphData = useMemo(() => {
    try {
      return prepareGraphData(relationships);
    } catch (err) {
      onError?.(err as Error);
      return { nodes: [], links: [] };
    }
  }, [relationships, onError]);

  // Enhanced node click handler with error boundary
  const handleNodeClick = useCallback((node: GraphNode) => {
    try {
      const relationship = relationships.find(rel => rel.contactId === node.id);
      if (relationship && onNodeClick) {
        onNodeClick(relationship);
      }
    } catch (err) {
      console.error('Error handling node click:', err);
      onError?.(err as Error);
    }
  }, [relationships, onNodeClick, onError]);

  // Performance optimization for graph rendering
  useEffect(() => {
    if (graphRef.current) {
      graphRef.current.d3Force('charge').strength(-100);
      graphRef.current.d3Force('link').distance(100);
    }
  }, []);

  // Accessibility keyboard navigation
  const handleKeyPress = useCallback((event: React.KeyboardEvent, node: GraphNode) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleNodeClick(node);
    }
  }, [handleNodeClick]);

  if (loading) {
    return (
      <Card className={className}>
        <Box display="flex" justifyContent="center" alignItems="center" height={height}>
          <CircularProgress aria-label="Loading relationship map" />
        </Box>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <Alert severity="error" aria-live="polite">
          Failed to load relationship map: {error.message}
        </Alert>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <Box
        role="region"
        aria-label={ariaLabel}
        sx={{
          height,
          width,
          position: 'relative',
          '& canvas': {
            borderRadius: theme.shape.borderRadius,
          }
        }}
      >
        <ForceGraph2D
          ref={graphRef}
          graphData={graphData}
          nodeLabel={node => (node as GraphNode).ariaLabel}
          nodeColor={node => (node as GraphNode).color}
          nodeVal={node => (node as GraphNode).value}
          linkColor={link => (link as GraphLink).color}
          linkWidth={link => Math.sqrt((link as GraphLink).value)}
          onNodeClick={handleNodeClick}
          onNodeKeyPress={handleKeyPress}
          enableNodeDrag={false}
          enableZoom={true}
          enablePanInteraction={true}
          nodeCanvasObject={(node, ctx, globalScale) => {
            const label = (node as GraphNode).name;
            const fontSize = 12/globalScale;
            ctx.font = `${fontSize}px Sans-Serif`;
            ctx.fillStyle = theme.palette.text.primary;
            ctx.textAlign = 'center';
            ctx.fillText(label, node.x!, node.y! + 8);
          }}
        />
        
        <Box
          position="absolute"
          bottom={16}
          right={16}
          bgcolor="background.paper"
          p={1}
          borderRadius={1}
        >
          <Typography variant="caption" component="div">
            {relationships.length} Relationships
          </Typography>
        </Box>
      </Box>
    </Card>
  );
});

RelationshipMap.displayName = 'RelationshipMap';

export default RelationshipMap;
export type { RelationshipMapProps };