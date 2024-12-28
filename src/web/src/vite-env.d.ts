/// <reference types="vite/client" />

/**
 * Type definitions for environment variables used in the application
 * @version 4.4.0
 */
interface ImportMetaEnv {
  /** Base URL for API endpoints */
  readonly VITE_API_URL: string;
  
  /** Auth0 domain for authentication */
  readonly VITE_AUTH0_DOMAIN: string;
  
  /** Auth0 client ID for authentication */
  readonly VITE_AUTH0_CLIENT_ID: string;
  
  /** Auth0 audience for API authorization */
  readonly VITE_AUTH0_AUDIENCE: string;
  
  /** Current deployment environment */
  readonly VITE_ENVIRONMENT: 'development' | 'staging' | 'production';
  
  /** API request timeout in milliseconds */
  readonly VITE_API_TIMEOUT: number;
  
  /** Flag to enable/disable analytics tracking */
  readonly VITE_ENABLE_ANALYTICS: boolean;
}

/**
 * Extends ImportMeta interface to include Vite-specific properties
 */
interface ImportMeta {
  /** Environment variables */
  readonly env: ImportMetaEnv;
  
  /** Hot module replacement API */
  readonly hot: {
    readonly accept: () => void;
  };
}

/**
 * Type declarations for static asset imports
 */
declare module '*.png' {
  const value: string;
  export default value;
}

declare module '*.jpg' {
  const value: string;
  export default value;
}

declare module '*.jpeg' {
  const value: string;
  export default value;
}

declare module '*.gif' {
  const value: string;
  export default value;
}

declare module '*.svg' {
  const value: string;
  export default value;
}

declare module '*.webp' {
  const value: string;
  export default value;
}

declare module '*.ico' {
  const value: string;
  export default value;
}

declare module '*.bmp' {
  const value: string;
  export default value;
}

// Font file declarations
declare module '*.woff' {
  const value: string;
  export default value;
}

declare module '*.woff2' {
  const value: string;
  export default value;
}

declare module '*.eot' {
  const value: string;
  export default value;
}

declare module '*.ttf' {
  const value: string;
  export default value;
}

declare module '*.otf' {
  const value: string;
  export default value;
}

// Media file declarations
declare module '*.mp4' {
  const value: string;
  export default value;
}

declare module '*.webm' {
  const value: string;
  export default value;
}

declare module '*.ogg' {
  const value: string;
  export default value;
}

declare module '*.mp3' {
  const value: string;
  export default value;
}

declare module '*.wav' {
  const value: string;
  export default value;
}

declare module '*.flac' {
  const value: string;
  export default value;
}

declare module '*.m4a' {
  const value: string;
  export default value;
}

// Document file declarations
declare module '*.pdf' {
  const value: string;
  export default value;
}

declare module '*.doc' {
  const value: string;
  export default value;
}

declare module '*.docx' {
  const value: string;
  export default value;
}

declare module '*.xls' {
  const value: string;
  export default value;
}

declare module '*.xlsx' {
  const value: string;
  export default value;
}

declare module '*.ppt' {
  const value: string;
  export default value;
}

declare module '*.pptx' {
  const value: string;
  export default value;
}

declare module '*.txt' {
  const value: string;
  export default value;
}

declare module '*.csv' {
  const value: string;
  export default value;
}

// Data file declarations
declare module '*.json' {
  const value: any;
  export default value;
}

declare module '*.yaml' {
  const value: any;
  export default value;
}

declare module '*.xml' {
  const value: string;
  export default value;
}