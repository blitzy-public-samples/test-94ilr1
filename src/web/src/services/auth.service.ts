// @auth0/auth0-spa-js version ^2.1.0
// rxjs version ^7.8.1
import { Auth0Client } from '@auth0/auth0-spa-js';
import { BehaviorSubject, Observable, timer, Subscription } from 'rxjs';
import {
  AuthState,
  User,
  AuthCredentials,
  TokenResponse,
  MFARequest,
  AuthResponse,
  AuthError,
  UserRole
} from '../types/auth.types';
import {
  auth0Config,
  authConfig,
  initialAuthState,
  createAuth0Client,
  securityUtils
} from '../config/auth.config';
import {
  login,
  verifyMFA,
  refreshToken,
  logout,
  getCurrentUser,
  security
} from '../api/auth.api';

/**
 * Enterprise-grade Authentication Service
 * Implements secure session management, MFA support, and reactive state updates
 */
export class AuthService {
  private authState$ = new BehaviorSubject<AuthState>(initialAuthState);
  private auth0Client: Auth0Client | null = null;
  private tokenRefreshSubscription: Subscription | null = null;
  private sessionTimeoutSubscription: Subscription | null = null;
  private authAttempts: number = 0;
  private readonly maxAuthAttempts = authConfig.errorHandling.maxRetries;

  constructor() {
    this.initialize();
  }

  /**
   * Initializes the authentication service
   * Sets up Auth0 client and restores previous session if available
   */
  private async initialize(): Promise<void> {
    try {
      this.auth0Client = await createAuth0Client();
      await this.checkExistingSession();
      this.setupSecurityMonitoring();
    } catch (error) {
      this.handleAuthError(error as Error);
    }
  }

  /**
   * Returns the current authentication state as an observable
   */
  public getAuthState(): Observable<AuthState> {
    return this.authState$.asObservable();
  }

  /**
   * Authenticates user with provided credentials
   * Implements rate limiting and MFA flow
   */
  public async loginWithCredentials(credentials: AuthCredentials): Promise<void> {
    try {
      if (this.authAttempts >= this.maxAuthAttempts) {
        throw new Error('Maximum authentication attempts exceeded');
      }

      this.updateAuthState({ loading: true, error: null });
      this.authAttempts++;

      const response = await login(credentials);
      
      if (response.requiresMFA) {
        this.updateAuthState({ mfaPending: true });
        return;
      }

      await this.handleAuthentication(response);
    } catch (error) {
      this.handleAuthError(error as Error);
    } finally {
      this.updateAuthState({ loading: false });
    }
  }

  /**
   * Handles MFA verification process
   * Implements secure token management after successful verification
   */
  public async handleMFAVerification(mfaRequest: MFARequest): Promise<void> {
    try {
      this.updateAuthState({ loading: true, error: null });
      
      const response = await verifyMFA(mfaRequest);
      await this.handleAuthentication(response);
      
      this.updateAuthState({ mfaPending: false });
    } catch (error) {
      this.handleAuthError(error as Error);
    } finally {
      this.updateAuthState({ loading: false });
    }
  }

  /**
   * Logs out user and cleans up session
   * Implements secure token revocation and state cleanup
   */
  public async logoutUser(): Promise<void> {
    try {
      this.updateAuthState({ loading: true, error: null });
      
      await logout();
      this.cleanupSubscriptions();
      
      this.updateAuthState({
        isAuthenticated: false,
        user: null,
        loading: false,
        error: null,
        mfaPending: false
      });
    } catch (error) {
      this.handleAuthError(error as Error);
    }
  }

  /**
   * Processes successful authentication
   * Sets up token refresh and session monitoring
   */
  private async handleAuthentication(response: AuthResponse): Promise<void> {
    const { user, tokens } = response;

    this.setupTokenRefresh(tokens);
    this.setupSessionMonitoring();
    this.authAttempts = 0;

    this.updateAuthState({
      isAuthenticated: true,
      user,
      loading: false,
      error: null
    });
  }

  /**
   * Sets up automatic token refresh
   * Implements secure token rotation with jitter
   */
  private setupTokenRefresh(tokens: TokenResponse): void {
    this.cleanupSubscriptions();

    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 30000; // 0-30 seconds
    const refreshInterval = authConfig.tokenRefreshInterval + jitter;

    this.tokenRefreshSubscription = timer(refreshInterval, refreshInterval)
      .subscribe(async () => {
        try {
          const newTokens = await refreshToken(tokens.refreshToken);
          this.setupTokenRefresh(newTokens);
        } catch (error) {
          await this.logoutUser();
        }
      });
  }

  /**
   * Sets up session monitoring
   * Implements idle timeout and absolute session duration
   */
  private setupSessionMonitoring(): void {
    const { absoluteTimeout, idleTimeout } = authConfig.sessionConfig;
    
    this.sessionTimeoutSubscription = timer(absoluteTimeout * 1000)
      .subscribe(() => this.logoutUser());

    // Reset idle timer on user activity
    const resetIdleTimer = () => {
      if (this.sessionTimeoutSubscription) {
        this.sessionTimeoutSubscription.unsubscribe();
        this.sessionTimeoutSubscription = timer(idleTimeout * 1000)
          .subscribe(() => this.logoutUser());
      }
    };

    window.addEventListener('mousemove', resetIdleTimer);
    window.addEventListener('keypress', resetIdleTimer);
  }

  /**
   * Checks for existing valid session
   * Implements secure session restoration
   */
  private async checkExistingSession(): Promise<void> {
    try {
      if (security.validateSession()) {
        const user = await getCurrentUser();
        this.updateAuthState({
          isAuthenticated: true,
          user,
          loading: false,
          error: null
        });
      } else {
        this.updateAuthState({ loading: false });
      }
    } catch (error) {
      this.updateAuthState({ loading: false });
    }
  }

  /**
   * Updates authentication state
   * Implements atomic state updates
   */
  private updateAuthState(partialState: Partial<AuthState>): void {
    this.authState$.next({
      ...this.authState$.value,
      ...partialState
    });
  }

  /**
   * Handles authentication errors
   * Implements secure error logging and state updates
   */
  private handleAuthError(error: Error): void {
    const authError: AuthError = {
      code: 'AUTH_ERROR',
      message: error.message,
      details: { timestamp: new Date().toISOString() }
    };

    console.error('Authentication error:', securityUtils.sanitizeError(authError));
    
    this.updateAuthState({
      error: authError,
      loading: false
    });
  }

  /**
   * Cleans up subscriptions
   * Implements proper resource cleanup
   */
  private cleanupSubscriptions(): void {
    if (this.tokenRefreshSubscription) {
      this.tokenRefreshSubscription.unsubscribe();
      this.tokenRefreshSubscription = null;
    }
    
    if (this.sessionTimeoutSubscription) {
      this.sessionTimeoutSubscription.unsubscribe();
      this.sessionTimeoutSubscription = null;
    }
  }
}

// Export singleton instance
export const authService = new AuthService();