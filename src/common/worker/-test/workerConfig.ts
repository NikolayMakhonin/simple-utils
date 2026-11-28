import { parentPort } from 'worker_threads'

// Defined exclusively by vite.config.define.ts, the config file that the test gives the thread
declare const __TEST_CONFIG_VALUE__: string

setTimeout(() => {
  parentPort!.postMessage(__TEST_CONFIG_VALUE__)
}, 100)
