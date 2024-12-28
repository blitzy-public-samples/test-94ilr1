import React, { useCallback, useMemo, useState } from 'react';
import { 
  Select as MuiSelect, 
  MenuItem, 
  FormControl, 
  InputLabel,
  SelectChangeEvent,
  FormHelperText,
  styled,
  useTheme
} from '@mui/material'; // v5.14+
import { lightTheme } from '../../styles/theme';
import { sanitizeInput } from '../../utils/validation.utils';

// Interfaces for component props and options
export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  'data-testid'?: string;
  'aria-label'?: string;
}

export interface SelectProps {
  options: SelectOption[];
  value: string | string[];
  onChange: (value: string | string[]) => void;
  label: string;
  multiple?: boolean;
  disabled?: boolean;
  error?: boolean;
  helperText?: string;
  required?: boolean;
  searchable?: boolean;
  loading?: boolean;
  maxHeight?: number;
  'aria-label'?: string;
  'data-testid'?: string;
}

// Styled components for enhanced visuals and accessibility
const StyledFormControl = styled(FormControl)(({ theme }) => ({
  width: '100%',
  '& .MuiOutlinedInput-root': {
    transition: theme.transitions.create(['border-color', 'box-shadow']),
    '&:hover': {
      borderColor: theme.palette.primary.main,
    },
    '&.Mui-focused': {
      boxShadow: `0 0 0 2px ${theme.palette.primary.main}25`,
    },
  },
  '& .MuiSelect-select': {
    minHeight: 40, // WCAG touch target size
    padding: theme.spacing(1.5, 2),
  },
}));

const StyledMenuItem = styled(MenuItem)(({ theme }) => ({
  minHeight: 40, // WCAG touch target size
  padding: theme.spacing(1, 2),
  '&.MuiMenuItem-root': {
    '&.Mui-selected': {
      backgroundColor: `${theme.palette.primary.main}15`,
    },
    '&.Mui-focusVisible': {
      backgroundColor: `${theme.palette.primary.main}25`,
    },
  },
}));

// Main component implementation
export const CustomSelect: React.FC<SelectProps> = React.memo(({
  options,
  value,
  onChange,
  label,
  multiple = false,
  disabled = false,
  error = false,
  helperText,
  required = false,
  searchable = false,
  loading = false,
  maxHeight = 300,
  'aria-label': ariaLabel,
  'data-testid': dataTestId,
}) => {
  const theme = useTheme();
  const [searchText, setSearchText] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  // Memoized filtered options based on search text
  const filteredOptions = useMemo(() => {
    if (!searchable || !searchText) return options;
    
    const sanitizedSearch = sanitizeInput(searchText.toLowerCase());
    return options.filter(option => 
      option.label.toLowerCase().includes(sanitizedSearch) ||
      option.value.toLowerCase().includes(sanitizedSearch)
    );
  }, [options, searchText, searchable]);

  // Handle select value change
  const handleChange = useCallback((event: SelectChangeEvent<string | string[]>) => {
    event.preventDefault();
    const selectedValue = event.target.value;
    
    // Sanitize selected value(s)
    const sanitizedValue = multiple 
      ? (selectedValue as string[]).map(val => sanitizeInput(val))
      : sanitizeInput(selectedValue as string);
    
    onChange(sanitizedValue);
  }, [multiple, onChange]);

  // Handle search input changes with debouncing
  const handleSearch = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const searchValue = event.target.value;
    const sanitizedSearch = sanitizeInput(searchValue);
    setSearchText(sanitizedSearch);
  }, []);

  // Generate unique ID for accessibility
  const selectId = useMemo(() => `select-${label.toLowerCase().replace(/\s+/g, '-')}`, [label]);

  return (
    <StyledFormControl
      error={error}
      disabled={disabled}
      required={required}
      data-testid={dataTestId}
    >
      <InputLabel
        id={`${selectId}-label`}
        required={required}
        error={error}
      >
        {label}
      </InputLabel>
      
      <MuiSelect
        id={selectId}
        labelId={`${selectId}-label`}
        value={value}
        onChange={handleChange}
        multiple={multiple}
        label={label}
        aria-label={ariaLabel || label}
        aria-invalid={error}
        aria-required={required}
        aria-busy={loading}
        open={isOpen}
        onOpen={() => setIsOpen(true)}
        onClose={() => {
          setIsOpen(false);
          setSearchText('');
        }}
        MenuProps={{
          PaperProps: {
            style: {
              maxHeight,
            },
          },
          TransitionProps: {
            onEnter: () => {
              // Announce to screen readers when menu opens
              const liveRegion = document.getElementById('select-live-region');
              if (liveRegion) {
                liveRegion.textContent = `${label} options list opened`;
              }
            },
          },
        }}
      >
        {/* Hidden live region for screen reader announcements */}
        <div
          id="select-live-region"
          aria-live="polite"
          className="visually-hidden"
          style={{ position: 'absolute', height: 1, width: 1, overflow: 'hidden' }}
        />
        
        {/* Search input for searchable select */}
        {searchable && isOpen && (
          <div style={{ padding: theme.spacing(1) }}>
            <input
              type="text"
              value={searchText}
              onChange={handleSearch}
              placeholder="Search options..."
              style={{
                width: '100%',
                padding: theme.spacing(1),
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: theme.shape.borderRadius,
              }}
              aria-label="Search options"
            />
          </div>
        )}
        
        {/* Render filtered options */}
        {filteredOptions.map((option) => (
          <StyledMenuItem
            key={option.value}
            value={option.value}
            disabled={option.disabled}
            data-testid={option['data-testid']}
            aria-label={option['aria-label'] || option.label}
          >
            {option.label}
          </StyledMenuItem>
        ))}
        
        {/* No results message */}
        {filteredOptions.length === 0 && (
          <MenuItem disabled>
            No options available
          </MenuItem>
        )}
      </MuiSelect>
      
      {/* Helper text or error message */}
      {helperText && (
        <FormHelperText error={error}>
          {helperText}
        </FormHelperText>
      )}
    </StyledFormControl>
  );
});

CustomSelect.displayName = 'CustomSelect';

export default CustomSelect;