// @mui/material v5.14+
import { Theme } from '@mui/material';
// react v18.2+
import { useEffect, useCallback } from 'react';
// react-redux v8.1+
import { useDispatch, useSelector } from 'react-redux';

// Internal imports
import { getTheme, getInitialTheme } from '../config/theme.config';
import { selectTheme } from '../store/settings.slice';

/**
 * Interface for useTheme hook return value with enhanced type safety
 */
interface UseThemeReturn {
  theme: Theme;
  mode: 'light' | 'dark' | 'system';
  toggleTheme: () => void;
  setThemeMode: (mode: 'light' | 'dark' | 'system') => void;
  error: string | null;
  isLoading: boolean;
}

/**
 * Custom hook for managing theme state and preferences with Material Design 3.0 support
 * Features:
 * - System-detected dark/light mode with manual override
 * - Theme persistence across sessions
 * - Accessibility validation
 * - Performance optimization with memoization
 * - Error handling and loading states
 * 
 * @returns {UseThemeReturn} Theme state and control functions
 */
const useTheme = (): UseThemeReturn => {
  // Initialize Redux hooks
  const dispatch = useDispatch();
  const currentThemeMode = useSelector(selectTheme);
  
  // Local state for error handling and loading
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  /**
   * Handles system theme preference changes with validation
   * @param {MediaQueryList} mediaQuery - System theme preference media query
   */
  const handleSystemThemeChange = useCallback((mediaQuery: MediaQueryList) => {
    if (currentThemeMode === 'system') {
      try {
        const newMode = mediaQuery.matches ? 'dark' : 'light';
        const newTheme = getTheme(newMode);
        
        // Update theme in Redux store
        dispatch(settingsActions.updateTheme(newMode));
        
        // Update system preference in localStorage
        localStorage.setItem('theme_preference', newMode);
        
        setError(null);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to update theme';
        setError(errorMessage);
        console.error('Theme update error:', err);
      }
    }
  }, [currentThemeMode, dispatch]);

  /**
   * Memoized theme toggle function
   */
  const toggleTheme = useCallback(() => {
    try {
      const newMode = currentThemeMode === 'light' ? 'dark' : 'light';
      const newTheme = getTheme(newMode);
      
      dispatch(settingsActions.updateTheme(newMode));
      localStorage.setItem('theme_preference', newMode);
      
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to toggle theme';
      setError(errorMessage);
      console.error('Theme toggle error:', err);
    }
  }, [currentThemeMode, dispatch]);

  /**
   * Memoized theme mode setter
   */
  const setThemeMode = useCallback((mode: 'light' | 'dark' | 'system') => {
    try {
      setIsLoading(true);
      
      let effectiveMode = mode;
      if (mode === 'system') {
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        effectiveMode = systemPrefersDark ? 'dark' : 'light';
      }
      
      const newTheme = getTheme(effectiveMode);
      
      dispatch(settingsActions.updateTheme(mode));
      localStorage.setItem('theme_preference', mode);
      
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to set theme mode';
      setError(errorMessage);
      console.error('Theme mode update error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [dispatch]);

  /**
   * Initialize theme and set up system theme change listener
   */
  useEffect(() => {
    try {
      setIsLoading(true);
      
      // Get initial theme preference
      const initialTheme = getInitialTheme();
      dispatch(settingsActions.updateTheme(initialTheme));
      
      // Set up system theme change listener
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = (e: MediaQueryListEvent) => handleSystemThemeChange(e.target as MediaQueryList);
      
      mediaQuery.addEventListener('change', listener);
      
      setError(null);
      
      // Cleanup listener on unmount
      return () => mediaQuery.removeEventListener('change', listener);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize theme';
      setError(errorMessage);
      console.error('Theme initialization error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [dispatch, handleSystemThemeChange]);

  // Get current theme object based on mode
  const theme = useMemo(() => {
    try {
      return getTheme(currentThemeMode === 'system' 
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : currentThemeMode
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get theme';
      setError(errorMessage);
      console.error('Theme generation error:', err);
      return getTheme('light'); // Fallback to light theme
    }
  }, [currentThemeMode]);

  return {
    theme,
    mode: currentThemeMode,
    toggleTheme,
    setThemeMode,
    error,
    isLoading
  };
};

export default useTheme;