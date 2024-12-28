import { defineConfig } from 'cypress'; // v12.0.0

export default defineConfig({
  e2e: {
    // Base configuration
    baseUrl: 'http://localhost:3000',
    specPattern: 'tests/e2e/**/*.spec.ts',
    supportFile: 'tests/support/e2e.ts',
    
    // Viewport configuration for responsive testing
    viewportWidth: 1280,
    viewportHeight: 720,
    
    // Timeout configurations for reliability
    defaultCommandTimeout: 10000,
    requestTimeout: 10000,
    responseTimeout: 30000,
    
    // Test retry configuration for improved reliability
    retries: {
      runMode: 2,
      openMode: 0,
    },
    
    // Video and screenshot configuration
    video: true,
    screenshotOnRunFailure: true,
    
    // Security and experimental features
    chromeWebSecurity: false,
    experimentalSessionAndOrigin: true,
    
    // Node event setup for plugins and additional configuration
    setupNodeEvents(on, config) {
      // Code coverage configuration
      require('@cypress/code-coverage/task')(on, config);
      
      // Configure Mochawesome reporter
      require('cypress-mochawesome-reporter/plugin')(on);
      
      // Environment variable handling
      config.env = {
        ...config.env,
        API_URL: process.env.API_URL || 'http://localhost:8080',
        AUTH_URL: process.env.AUTH_URL || 'http://localhost:8081',
        TEST_USER_EMAIL: process.env.TEST_USER_EMAIL,
        TEST_USER_PASSWORD: process.env.TEST_USER_PASSWORD,
      };
      
      // File preprocessing for TypeScript support
      on('file:preprocessor', require('@cypress/webpack-preprocessor')({
        webpackOptions: {
          resolve: {
            extensions: ['.ts', '.js'],
          },
          module: {
            rules: [
              {
                test: /\.ts$/,
                exclude: /node_modules/,
                use: [
                  {
                    loader: 'ts-loader',
                    options: {
                      transpileOnly: true,
                    },
                  },
                ],
              },
            ],
          },
        },
      }));
      
      // Custom event handlers for test cleanup
      on('task', {
        // Database cleanup task
        async resetTestData() {
          // Implementation would be provided in support files
          return null;
        },
        
        // Log cleanup task
        async clearTestLogs() {
          // Implementation would be provided in support files
          return null;
        },
      });
      
      // Browser launch options
      on('before:browser:launch', (browser, launchOptions) => {
        if (browser.name === 'chrome' && browser.isHeadless) {
          launchOptions.args.push('--disable-gpu');
          launchOptions.args.push('--no-sandbox');
          launchOptions.args.push('--disable-dev-shm-usage');
        }
        return launchOptions;
      });
      
      return config;
    },
  },
  
  // Reporter configuration
  reporter: 'cypress-mochawesome-reporter',
  reporterOptions: {
    reportDir: 'cypress/reports',
    overwrite: false,
    html: true,
    json: true,
    timestamp: true,
    quiet: true,
    charts: true,
    embeddedScreenshots: true,
    inlineAssets: true,
  },
  
  // Component testing configuration
  component: {
    devServer: {
      framework: 'react',
      bundler: 'webpack',
    },
    specPattern: 'tests/component/**/*.spec.ts',
    supportFile: 'tests/support/component.ts',
  },
});