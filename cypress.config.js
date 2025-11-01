const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    // Base URL for the application under test
    baseUrl: 'https://events.webmobi.com',
    
    // Video recording settings
    video: true,
    videoCompression: 32,
    videosFolder: 'cypress/videos',
    
    // Screenshot settings
    screenshotOnRunFailure: true,
    screenshotsFolder: 'cypress/screenshots',
    
    // Viewport settings
    viewportWidth: 1280,
    viewportHeight: 720,
    
    // Timeouts
    defaultCommandTimeout: 10000,
    pageLoadTimeout: 30000,
    requestTimeout: 10000,
    
    // Retry settings
    retries: {
      runMode: 1,
      openMode: 0
    },
    
    // Browser settings
    chromeWebSecurity: false, // Disable to avoid CORS issues during testing
    
    setupNodeEvents(on, config) {
      // implement node event listeners here
      
      // Log when tests start
      on('before:run', (details) => {
        console.log('Starting test run...');
        console.log('Browser:', details.browser.name);
        console.log('Specs:', details.specs.length);
      });
      
      // Log when tests complete
      on('after:run', (results) => {
        console.log('Test run completed!');
        console.log('Total tests:', results.totalTests);
        console.log('Passed:', results.totalPassed);
        console.log('Failed:', results.totalFailed);
        console.log('Duration:', results.totalDuration + 'ms');
      });
      
      return config;
    },
  },
  
  // Environment variables
  env: {
    apiUrl: 'https://events.webmobi.com/api',
  },
});