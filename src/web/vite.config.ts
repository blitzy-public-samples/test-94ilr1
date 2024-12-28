// @vitejs/plugin-react version: 4.0.0
// vite version: 4.4.0
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  // React plugin configuration with Fast Refresh and automatic JSX runtime
  plugins: [
    react({
      fastRefresh: true, // Enable Fast Refresh for development
      jsxRuntime: 'automatic', // Use the automatic JSX runtime
      babel: {
        // Additional Babel plugins if needed
        plugins: [],
      },
    }),
  ],

  // Path resolution and aliases
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@services': path.resolve(__dirname, './src/services'),
      '@store': path.resolve(__dirname, './src/store'),
      '@api': path.resolve(__dirname, './src/api'),
      '@types': path.resolve(__dirname, './src/types'),
      '@constants': path.resolve(__dirname, './src/constants'),
      '@assets': path.resolve(__dirname, './src/assets'),
      '@styles': path.resolve(__dirname, './src/styles'),
    },
  },

  // Development server configuration
  server: {
    port: 3000,
    strictPort: true, // Fail if port is already in use
    host: true, // Listen on all addresses
    cors: true, // Enable CORS for development
    watch: {
      usePolling: true, // Enable polling for containers/VMs
    },
  },

  // Preview server configuration (for production builds)
  preview: {
    port: 3000,
    strictPort: true,
    host: true,
  },

  // Build configuration
  build: {
    // Browser compatibility targets based on requirements
    target: ['chrome90', 'firefox88', 'safari14', 'edge90'],
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true, // Generate source maps for debugging
    minify: 'terser', // Use Terser for minification
    cssMinify: true, // Enable CSS minification
    modulePreload: true, // Enable module preloading
    cssCodeSplit: true, // Enable CSS code splitting
    chunkSizeWarningLimit: 1000, // Set chunk size warning limit
    
    // Rollup-specific options
    rollupOptions: {
      output: {
        // Manual chunk splitting for optimal caching
        manualChunks: {
          // Core vendor dependencies
          vendor: ['react', 'react-dom', 'react-router-dom'],
          // Material-UI and emotion
          mui: ['@mui/material', '@emotion/react', '@emotion/styled'],
          // Redux toolkit and integration
          redux: ['@reduxjs/toolkit', 'react-redux'],
          // React Query
          query: ['@tanstack/react-query'],
        },
      },
    },
  },

  // Test environment configuration
  test: {
    globals: true, // Enable global test variables
    environment: 'jsdom', // Use jsdom for DOM simulation
    setupFiles: ['./src/setupTests.ts'], // Test setup file
  },

  // Define global constants
  define: {
    __APP_VERSION__: JSON.stringify('1.0.0'),
    // Add any other global constants needed
  },

  // Optimization configuration
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@mui/material',
      '@emotion/react',
      '@emotion/styled',
      '@reduxjs/toolkit',
      'react-redux',
      '@tanstack/react-query',
    ],
    exclude: [], // Dependencies to exclude from optimization
  },

  // CSS configuration
  css: {
    modules: {
      localsConvention: 'camelCase', // Use camelCase for CSS modules
    },
    preprocessorOptions: {
      // Add preprocessor options if needed
    },
  },

  // Environment variables configuration
  envPrefix: 'VITE_', // Prefix for environment variables
});