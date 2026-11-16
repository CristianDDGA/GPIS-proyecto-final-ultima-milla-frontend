import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://127.0.0.1:5173',
    supportFile: false,
    video: false,
    screenshotOnRunFailure: false,
    defaultCommandTimeout: 12000,
    requestTimeout: 20000,
    responseTimeout: 20000,
  },
  expose: {
    apiUrl: 'http://127.0.0.1:3000',
  },
});
