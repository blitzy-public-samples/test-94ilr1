import React, { useState, useCallback, useRef, useEffect } from 'react';
import { TextField as MuiTextField } from '@mui/material';
import { styled } from '@mui/material/styles';
import { lightTheme } from '../../styles/theme';
import { validateEmail, sanitizeInput } from '../../utils/validation.utils';

// Version comments for external dependencies
// @mui/material v5.14+
// react v18.2+

// Styled component extending MUI TextField with Material Design 3.0 principles
const StyledTextField = styled(MuiTextField)(({ theme }) => ({
  '& .MuiInputBase-root': {
    borderRadius: theme.spacing(1),
    backgroundColor: theme.palette.background.paper,
    transition: theme.transitions.create([
      'border-color',
      'background-color',
      'box-shadow',
    ]),
    fontFamily: theme.typography.fontFamily,
    fontSize: theme.typography.emailBody.fontSize,
    '&.Mui-focused': {
      boxShadow: `0 0 0 2px ${theme.palette.primary.main}`,
    },
  },
  '& .MuiInputLabel-root': {
    fontSize: theme.typography.emailMeta.fontSize,
    transition: theme.transitions.create('color'),
    '&.Mui-focused': {
      color: theme.palette.primary.main,
    },
  },
  '& .MuiInputBase-input': {
    padding: theme.spacing(1.5, 2),
    '&::placeholder': {
      color: theme.palette.text.secondary,
      opacity: 0.7,
    },
  },
  '& .MuiFormHelperText-root': {
    fontSize: theme.typography.emailMeta.fontSize,
    marginTop: theme.spacing(0.5),
  },
  // Enhanced accessibility styles
  '& .MuiInputBase-input:focus-visible': {
    outline: 'none',
  },
  '&:hover .MuiInputBase-root': {
    backgroundColor: theme.palette.action.hover,
  },
  // Error state styling
  '& .Mui-error': {
    '& .MuiInputBase-root': {
      borderColor: theme.palette.error.main,
    },
    '& .MuiFormHelperText-root': {
      color: theme.palette.error.main,
    },
  },
}));

// Comprehensive props interface
export interface TextFieldProps {
  name: string;
  value: string;
  onChange: (value: string, isValid: boolean) => void;
  type?: 'text' | 'email' | 'password';
  error?: string;
  helperText?: string;
  required?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  autoFocus?: boolean;
  label?: string;
  placeholder?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
}

// Debounce utility for performance optimization
const useDebounce = (callback: Function, delay: number) => {
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback((...args: any[]) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      callback(...args);
    }, delay);
  }, [callback, delay]);
};

// Main TextField component
export const TextField: React.FC<TextFieldProps> = ({
  name,
  value,
  onChange,
  type = 'text',
  error,
  helperText,
  required = false,
  disabled = false,
  fullWidth = true,
  autoFocus = false,
  label,
  placeholder,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
}) => {
  // Internal state for validation
  const [internalError, setInternalError] = useState<string | undefined>(error);
  const [isDirty, setIsDirty] = useState(false);

  // Validation function
  const validateInput = useCallback((inputValue: string): boolean => {
    if (!inputValue && required) {
      setInternalError('This field is required');
      return false;
    }

    if (type === 'email' && inputValue) {
      const isValidEmail = validateEmail(inputValue);
      if (!isValidEmail) {
        setInternalError('Please enter a valid email address');
        return false;
      }
    }

    setInternalError(undefined);
    return true;
  }, [required, type]);

  // Debounced change handler
  const debouncedValidation = useDebounce((value: string) => {
    const isValid = validateInput(value);
    onChange(value, isValid);
  }, 300);

  // Change handler with sanitization
  const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = event.target.value;
    const sanitizedValue = sanitizeInput(rawValue);

    if (!isDirty) {
      setIsDirty(true);
    }

    debouncedValidation(sanitizedValue);
  }, [isDirty, debouncedValidation]);

  // Focus handler for accessibility
  const handleFocus = useCallback(() => {
    if (!isDirty) {
      setIsDirty(true);
    }
  }, [isDirty]);

  // Blur handler for immediate validation
  const handleBlur = useCallback(() => {
    validateInput(value);
  }, [value, validateInput]);

  return (
    <StyledTextField
      name={name}
      value={value}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      type={type}
      error={!!internalError}
      helperText={internalError || helperText}
      required={required}
      disabled={disabled}
      fullWidth={fullWidth}
      autoFocus={autoFocus}
      label={label}
      placeholder={placeholder}
      inputProps={{
        'aria-label': ariaLabel,
        'aria-describedby': ariaDescribedBy,
        'aria-required': required,
        'aria-invalid': !!internalError,
      }}
      FormHelperTextProps={{
        role: internalError ? 'alert' : undefined,
      }}
    />
  );
};

export default TextField;