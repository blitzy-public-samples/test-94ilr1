import React from 'react';
import { styled, useTheme } from '@mui/material/styles'; // v5.14+
import { Card, CardContent, Typography, Skeleton, Tooltip } from '@mui/material'; // v5.14+
import {
  Download as DownloadIcon,
  Visibility as PreviewIcon,
  PictureAsPdf as PdfIcon,
  Image as ImageIcon,
  Description as DocIcon,
  AttachmentOutlined as AttachmentIcon
} from '@mui/icons-material'; // v5.14+

import { IAttachment } from '../../types/email.types';
import { formatAttachment } from '../../utils/email.utils';
import CustomIconButton from '../common/IconButton';

// Constants for file type handling
const PREVIEW_SUPPORTED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

const MAX_PREVIEW_SIZE = 10 * 1024 * 1024; // 10MB

// File type to icon mapping
const FILE_TYPE_ICONS: { [key: string]: React.ElementType } = {
  'application/pdf': PdfIcon,
  'image': ImageIcon,
  'application/msword': DocIcon,
  'application/vnd.openxmlformats-officedocument': DocIcon,
  'text/plain': AttachmentIcon,
  'default': AttachmentIcon
};

// Props interface
interface AttachmentPreviewProps {
  attachment: IAttachment;
  onDownload: (attachment: IAttachment) => Promise<void>;
  onPreview: (attachment: IAttachment) => Promise<void>;
  className?: string;
  disabled?: boolean;
  loading?: boolean;
}

// Styled components
const StyledPreviewCard = styled(Card, {
  shouldForwardProp: (prop) => prop !== 'disabled',
})<{ disabled?: boolean }>(({ theme, disabled }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: theme.spacing(1.5),
  backgroundColor: disabled ? theme.palette.action.disabledBackground : theme.palette.background.paper,
  borderRadius: theme.spacing(1),
  transition: theme.transitions.create(['background-color', 'box-shadow']),
  
  '&:hover': !disabled && {
    backgroundColor: theme.palette.action.hover,
  },

  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(1),
  },

  // High contrast mode support
  '@media (forced-colors: active)': {
    borderColor: 'ButtonText',
  }
}));

// Main component
export const AttachmentPreview = React.memo<AttachmentPreviewProps>(({
  attachment,
  onDownload,
  onPreview,
  className,
  disabled = false,
  loading = false
}) => {
  const theme = useTheme();

  // Get formatted attachment details
  const { formattedSize } = formatAttachment(attachment);

  // Determine if preview is available
  const canPreview = React.useMemo(() => {
    return PREVIEW_SUPPORTED_TYPES.some(type => 
      attachment.contentType.startsWith(type)) && 
      attachment.size <= MAX_PREVIEW_SIZE;
  }, [attachment]);

  // Get appropriate icon based on file type
  const FileIcon = React.useMemo(() => {
    const iconKey = Object.keys(FILE_TYPE_ICONS).find(key => 
      attachment.contentType.startsWith(key)) || 'default';
    return FILE_TYPE_ICONS[iconKey];
  }, [attachment.contentType]);

  // Handle download with error prevention
  const handleDownload = async (event: React.MouseEvent) => {
    event.preventDefault();
    if (!disabled && !loading) {
      try {
        await onDownload(attachment);
      } catch (error) {
        console.error('Download failed:', error);
      }
    }
  };

  // Handle preview with error prevention
  const handlePreview = async (event: React.MouseEvent) => {
    event.preventDefault();
    if (!disabled && !loading && canPreview) {
      try {
        await onPreview(attachment);
      } catch (error) {
        console.error('Preview failed:', error);
      }
    }
  };

  if (loading) {
    return (
      <StyledPreviewCard disabled className={className}>
        <Skeleton variant="rectangular" width="100%" height={60} />
      </StyledPreviewCard>
    );
  }

  return (
    <StyledPreviewCard 
      disabled={disabled}
      className={className}
      role="article"
      aria-label={`Attachment: ${attachment.filename}`}
    >
      <CardContent sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        width: '100%',
        padding: theme.spacing(1),
        '&:last-child': { paddingBottom: theme.spacing(1) }
      }}>
        <FileIcon
          aria-hidden="true"
          sx={{
            marginRight: theme.spacing(1.5),
            color: theme.palette.text.secondary
          }}
        />
        
        <div style={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="body2"
            noWrap
            title={attachment.filename}
            sx={{ fontWeight: theme.typography.fontWeightMedium }}
          >
            {attachment.filename}
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            component="span"
          >
            {formattedSize}
          </Typography>
        </div>

        <div style={{ display: 'flex', gap: theme.spacing(1) }}>
          <Tooltip title="Download attachment">
            <span>
              <CustomIconButton
                size="small"
                onClick={handleDownload}
                disabled={disabled}
                ariaLabel={`Download ${attachment.filename}`}
              >
                <DownloadIcon fontSize="small" />
              </CustomIconButton>
            </span>
          </Tooltip>

          {canPreview && (
            <Tooltip title="Preview attachment">
              <span>
                <CustomIconButton
                  size="small"
                  onClick={handlePreview}
                  disabled={disabled}
                  ariaLabel={`Preview ${attachment.filename}`}
                >
                  <PreviewIcon fontSize="small" />
                </CustomIconButton>
              </span>
            </Tooltip>
          )}
        </div>
      </CardContent>
    </StyledPreviewCard>
  );
});

AttachmentPreview.displayName = 'AttachmentPreview';

export default AttachmentPreview;