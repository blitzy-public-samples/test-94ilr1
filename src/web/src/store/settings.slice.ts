// External dependencies
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'; // ^1.9.0

// Internal imports
import { ApiResponse } from '../types/api.types';
import { ApiService } from '../services/api.service';

/**
 * Settings state interface with comprehensive configuration options
 */
interface SettingsState {
  theme: 'light' | 'dark' | 'system';
  emailPreferences: {
    autoResponses: boolean;
    requireApproval: boolean;
    responseDelay: number;
    signature: string;
  };
  notificationPreferences: {
    emailNotifications: boolean;
    desktopNotifications: boolean;
    soundEnabled: boolean;
  };
  securitySettings: {
    mfaEnabled: boolean;
    sessionTimeout: number;
  };
  loading: boolean;
  error: string | null;
  lastUpdated: string | null;
  validationStatus: 'idle' | 'pending' | 'success' | 'error';
}

/**
 * Settings update payload type with validation
 */
interface SettingsUpdatePayload {
  theme?: 'light' | 'dark' | 'system';
  emailPreferences?: Partial<SettingsState['emailPreferences']>;
  notificationPreferences?: Partial<SettingsState['notificationPreferences']>;
  securitySettings?: Partial<SettingsState['securitySettings']>;
}

/**
 * Initial settings state with default values
 */
const initialState: SettingsState = {
  theme: 'system',
  emailPreferences: {
    autoResponses: false,
    requireApproval: true,
    responseDelay: 5,
    signature: ''
  },
  notificationPreferences: {
    emailNotifications: true,
    desktopNotifications: true,
    soundEnabled: true
  },
  securitySettings: {
    mfaEnabled: false,
    sessionTimeout: 30
  },
  loading: false,
  error: null,
  lastUpdated: null,
  validationStatus: 'idle'
};

/**
 * Enhanced async thunk for fetching user settings with retry mechanism
 */
export const fetchSettings = createAsyncThunk(
  'settings/fetchSettings',
  async (_, { rejectWithValue }) => {
    try {
      const apiService = new ApiService();
      const response = await apiService.get<SettingsState>('/api/v1/settings');

      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Failed to fetch settings');
      }

      return response.data;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }
);

/**
 * Enhanced async thunk for updating user settings with validation
 */
export const updateSettings = createAsyncThunk(
  'settings/updateSettings',
  async (settings: SettingsUpdatePayload, { rejectWithValue }) => {
    try {
      // Validate settings before sending
      validateSettingsPayload(settings);

      const apiService = new ApiService();
      const response = await apiService.post<SettingsState>('/api/v1/settings', settings);

      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Failed to update settings');
      }

      return response.data;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }
);

/**
 * Settings validation utility
 */
const validateSettingsPayload = (settings: SettingsUpdatePayload): void => {
  if (settings.theme && !['light', 'dark', 'system'].includes(settings.theme)) {
    throw new Error('Invalid theme value');
  }

  if (settings.emailPreferences?.responseDelay !== undefined) {
    if (settings.emailPreferences.responseDelay < 0 || settings.emailPreferences.responseDelay > 60) {
      throw new Error('Response delay must be between 0 and 60 minutes');
    }
  }

  if (settings.securitySettings?.sessionTimeout !== undefined) {
    if (settings.securitySettings.sessionTimeout < 5 || settings.securitySettings.sessionTimeout > 120) {
      throw new Error('Session timeout must be between 5 and 120 minutes');
    }
  }
};

/**
 * Enhanced settings slice with comprehensive state management
 */
const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setTheme: (state, action: PayloadAction<SettingsState['theme']>) => {
      state.theme = action.payload;
      state.lastUpdated = new Date().toISOString();
    },
    setEmailPreferences: (state, action: PayloadAction<Partial<SettingsState['emailPreferences']>>) => {
      state.emailPreferences = { ...state.emailPreferences, ...action.payload };
      state.lastUpdated = new Date().toISOString();
    },
    setNotificationPreferences: (state, action: PayloadAction<Partial<SettingsState['notificationPreferences']>>) => {
      state.notificationPreferences = { ...state.notificationPreferences, ...action.payload };
      state.lastUpdated = new Date().toISOString();
    },
    setSecuritySettings: (state, action: PayloadAction<Partial<SettingsState['securitySettings']>>) => {
      state.securitySettings = { ...state.securitySettings, ...action.payload };
      state.lastUpdated = new Date().toISOString();
    },
    resetSettings: (state) => {
      return { ...initialState, lastUpdated: new Date().toISOString() };
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch settings handlers
      .addCase(fetchSettings.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.validationStatus = 'pending';
      })
      .addCase(fetchSettings.fulfilled, (state, action) => {
        return {
          ...action.payload,
          loading: false,
          error: null,
          lastUpdated: new Date().toISOString(),
          validationStatus: 'success'
        };
      })
      .addCase(fetchSettings.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
        state.validationStatus = 'error';
      })
      // Update settings handlers
      .addCase(updateSettings.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.validationStatus = 'pending';
      })
      .addCase(updateSettings.fulfilled, (state, action) => {
        return {
          ...action.payload,
          loading: false,
          error: null,
          lastUpdated: new Date().toISOString(),
          validationStatus: 'success'
        };
      })
      .addCase(updateSettings.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
        state.validationStatus = 'error';
      });
  }
});

// Export actions
export const {
  setTheme,
  setEmailPreferences,
  setNotificationPreferences,
  setSecuritySettings,
  resetSettings
} = settingsSlice.actions;

// Export selectors
export const selectTheme = (state: { settings: SettingsState }) => state.settings.theme;
export const selectEmailPreferences = (state: { settings: SettingsState }) => state.settings.emailPreferences;
export const selectNotificationPreferences = (state: { settings: SettingsState }) => state.settings.notificationPreferences;
export const selectSecuritySettings = (state: { settings: SettingsState }) => state.settings.securitySettings;
export const selectSettingsError = (state: { settings: SettingsState }) => state.settings.error;
export const selectSettingsLoading = (state: { settings: SettingsState }) => state.settings.loading;
export const selectSettingsValidationStatus = (state: { settings: SettingsState }) => state.settings.validationStatus;

// Export reducer
export default settingsSlice.reducer;