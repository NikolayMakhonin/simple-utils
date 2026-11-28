import { defineConfig } from 'vite'

// The config file that the test of the option configFile of createWorkerVite gives the thread
export default defineConfig({
  define: { __TEST_CONFIG_VALUE__: JSON.stringify('loaded') },
})
