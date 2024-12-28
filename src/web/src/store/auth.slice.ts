// @reduxjs/toolkit version ^1.9.7
import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit';
import { 
  AuthState, 
  User, 
  AuthCredentials, 
  TokenResponse, 
  MFARequest, 
  AuthResponse, 
  RolePermissions,
  UserRole
} from '../types/auth.types';
import { AuthService } from '../services/auth.service';

// Initial state with comprehensive security tracking
const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  userRole: null,
  permissions: null,
  sessionValid: false,
  loading: false,
  error: null,
  lastValidated: null,
  mfaPending: false,
  securityEvents: []
};

// Enhanced async thunk for secure user login
export const login = createAsyncThunk(
  'auth/login',
  async (credentials: AuthCredentials, { rejectWithValue }) => {
    try {
      // Input validation
      if (!credentials.email || !credentials.password) {
        throw new Error('Invalid credentials format');
      }

      const response = await AuthService.loginWithCredentials(credentials);
      return response;
    } catch (error) {
      return rejectWithValue({
        code: 'AUTH_ERROR',
        message: error instanceof Error ? error.message : 'Authentication failed',
        details: { timestamp: new Date().toISOString() }
      });
    }
  }
);

// Enhanced async thunk for MFA verification
export const verifyMFA = createAsyncThunk(
  'auth/verifyMFA',
  async (mfaRequest: MFARequest, { rejectWithValue }) => {
    try {
      // MFA request validation
      if (!mfaRequest.code || !mfaRequest.challengeId) {
        throw new Error('Invalid MFA request format');
      }

      const response = await AuthService.handleMFAVerification(mfaRequest);
      return response;
    } catch (error) {
      return rejectWithValue({
        code: 'MFA_ERROR',
        message: error instanceof Error ? error.message : 'MFA verification failed',
        details: { timestamp: new Date().toISOString() }
      });
    }
  }
);

// Session validation thunk
export const validateSession = createAsyncThunk(
  'auth/validateSession',
  async (_, { rejectWithValue }) => {
    try {
      const isValid = await AuthService.validateSession();
      return isValid;
    } catch (error) {
      return rejectWithValue({
        code: 'SESSION_ERROR',
        message: error instanceof Error ? error.message : 'Session validation failed',
        details: { timestamp: new Date().toISOString() }
      });
    }
  }
);

// Logout thunk with secure cleanup
export const logout = createAsyncThunk(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      await AuthService.logoutUser();
    } catch (error) {
      return rejectWithValue({
        code: 'LOGOUT_ERROR',
        message: error instanceof Error ? error.message : 'Logout failed',
        details: { timestamp: new Date().toISOString() }
      });
    }
  }
);

// Enhanced auth slice with comprehensive security features
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    // Reset auth state
    resetAuthState: (state) => {
      return { ...initialState, loading: false };
    },
    // Update session timestamp
    updateSessionTimestamp: (state) => {
      state.lastValidated = new Date().toISOString();
    },
    // Add security event
    addSecurityEvent: (state, action) => {
      state.securityEvents.push({
        ...action.payload,
        timestamp: new Date().toISOString()
      });
    }
  },
  extraReducers: (builder) => {
    // Login handling
    builder.addCase(login.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(login.fulfilled, (state, action) => {
      const { user, requiresMFA } = action.payload;
      state.loading = false;
      state.user = user;
      state.userRole = user.roles[0];
      state.mfaPending = requiresMFA;
      state.isAuthenticated = !requiresMFA;
      state.sessionValid = !requiresMFA;
      state.lastValidated = new Date().toISOString();
    });
    builder.addCase(login.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as any;
      state.isAuthenticated = false;
      state.sessionValid = false;
    });

    // MFA verification handling
    builder.addCase(verifyMFA.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(verifyMFA.fulfilled, (state, action) => {
      const { user } = action.payload;
      state.loading = false;
      state.user = user;
      state.userRole = user.roles[0];
      state.mfaPending = false;
      state.isAuthenticated = true;
      state.sessionValid = true;
      state.lastValidated = new Date().toISOString();
    });
    builder.addCase(verifyMFA.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as any;
    });

    // Session validation handling
    builder.addCase(validateSession.fulfilled, (state, action) => {
      state.sessionValid = action.payload;
      state.lastValidated = new Date().toISOString();
    });
    builder.addCase(validateSession.rejected, (state) => {
      state.sessionValid = false;
      state.isAuthenticated = false;
    });

    // Logout handling
    builder.addCase(logout.fulfilled, (state) => {
      return { ...initialState, loading: false };
    });
  }
});

// Export actions
export const { resetAuthState, updateSessionTimestamp, addSecurityEvent } = authSlice.actions;

// Enhanced selectors with memoization
export const selectAuthState = (state: { auth: AuthState }) => state.auth;

export const selectUser = createSelector(
  [selectAuthState],
  (auth) => auth.user
);

export const selectUserRole = createSelector(
  [selectAuthState],
  (auth) => auth.userRole
);

export const selectPermissions = createSelector(
  [selectAuthState],
  (auth) => auth.permissions
);

export const selectIsAuthenticated = createSelector(
  [selectAuthState],
  (auth) => auth.isAuthenticated && auth.sessionValid
);

export const selectMFAStatus = createSelector(
  [selectAuthState],
  (auth) => ({
    mfaPending: auth.mfaPending,
    mfaEnabled: auth.user?.mfaEnabled || false
  })
);

export const selectSecurityStatus = createSelector(
  [selectAuthState],
  (auth) => ({
    isAuthenticated: auth.isAuthenticated,
    sessionValid: auth.sessionValid,
    lastValidated: auth.lastValidated,
    hasErrors: !!auth.error
  })
);

// Export reducer
export default authSlice.reducer;