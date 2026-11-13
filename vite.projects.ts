import { defineConfig, mergeConfig } from 'vitest/config'
import type { BrowserConfigOptions } from 'vitest/node'
import { playwright } from '@vitest/browser-playwright'
import { preview } from '@vitest/browser-preview'
import configBase from './vite.config'

export default defineConfig(env => {
  const config = configBase(env)
  return mergeConfig(
    // A project with `extends: true` concatenates its include with the include of this config,
    // so this config takes no test files, and each project takes exclusively the files of its own include
    { ...config, test: { ...config.test, include: [] } },
    {
      test: {
        projects: [
          {
            extends: true,
            resolve: {
              conditions: ['node'],
            },
            test: {
              name: {
                label: 'node',
                // color: 'blue',
              },
              include: ['**/*.{test,node}.{js,ts}'],
              exclude: [
                '**/*.{long,stress,perf,manual}.{test,node}.{js,ts}',
                'src/browser/**',
              ],
              // A slow file can take a couple of minutes
              testTimeout: 2 * 60 * 1000,
            },
          },
          {
            extends: true,
            resolve: {
              conditions: ['node'],
            },
            test: {
              name: {
                label: 'node-long',
              },
              include: ['**/*.{long,stress}.{test,node}.{js,ts}'],
              exclude: ['src/browser/**'],
            },
          },
          {
            extends: true,
            resolve: {
              conditions: ['browser'],
            },
            test: {
              name: {
                label: 'browser',
                // color: 'green',
              },
              include: ['**/*.{test,browser}.{js,ts}'],
              exclude: [
                '**/*.{long,stress,perf,manual}.{test,browser}.{js,ts}',
                'src/node/**',
              ],
              // A browser file can take a couple of minutes, as a slow file can
              testTimeout: 2 * 60 * 1000,
              browser: createBrowserOptionsHeadless(4001),
            },
          },
          {
            extends: true,
            resolve: {
              conditions: ['browser'],
            },
            test: {
              name: {
                label: 'browser-long',
              },
              include: ['**/*.{long,stress}.{test,browser}.{js,ts}'],
              exclude: ['src/node/**'],
              browser: createBrowserOptionsHeadless(4003),
            },
          },
          {
            extends: true,
            resolve: {
              conditions: ['node'],
            },
            test: {
              name: {
                label: 'node-perf',
              },
              include: ['**/*.perf.{test,node}.{js,ts}'],
              exclude: ['src/browser/**'],
              // Measurements running at the same time slow each other down
              fileParallelism: false,
            },
          },
          {
            extends: true,
            resolve: {
              conditions: ['browser'],
            },
            test: {
              name: {
                label: 'browser-perf',
              },
              include: ['**/*.perf.{test,browser}.{js,ts}'],
              exclude: ['src/node/**'],
              // Measurements running at the same time slow each other down,
              // so a run takes one browser, chosen by --browser
              fileParallelism: false,
              browser: createBrowserOptionsHeadless(4004),
            },
          },
          {
            extends: true,
            resolve: {
              conditions: ['node'],
            },
            test: {
              name: {
                label: 'node-manual',
              },
              include: ['**/*.manual.{test,node}.{js,ts}'],
              exclude: ['src/browser/**'],
            },
          },
          {
            extends: true,
            resolve: {
              conditions: ['browser'],
            },
            test: {
              name: {
                label: 'browser-manual',
              },
              include: ['**/*.manual.{test,browser}.{js,ts}'],
              exclude: ['src/node/**'],
              browser: createBrowserOptionsHeadless(4005),
            },
          },
          {
            extends: true,
            resolve: {
              conditions: ['node'],
            },
            test: {
              name: {
                label: 'e2e',
              },
              include: ['**/*.e2e.{slow,long,manual}.{js,ts}'],
              exclude: ['src/browser/**'],
            },
          },
          {
            extends: true,
            resolve: {
              conditions: ['browser'],
            },
            test: {
              name: {
                label: 'chrome',
              },
              include: ['**/*.chrome.{js,ts}'],
              exclude: ['src/node/**'],
              // Tests of my Chrome share my Google login and Drive, so its files run one at a time
              fileParallelism: false,
              browser: {
                enabled: true,
                provider: preview(),
                headless: false,
                ui: false,
                screenshotDirectory: './tmp/test/screenshots',
                screenshotFailures: false,
                instances: [{ browser: 'chromium' }],
                api: {
                  port: 4002,
                },
              },
            },
          },
        ],
      },
    },
  )
})

// The headless Chromium, Firefox, and WebKit of Playwright, shared by every headless browser project
function createBrowserOptionsHeadless(port: number): BrowserConfigOptions {
  return {
    enabled: true,
    provider: playwright(),
    headless: true,
    ui: false,
    screenshotDirectory: './tmp/test/screenshots',
    screenshotFailures: false,
    // https://vitest.dev/guide/browser/playwright
    instances: [
      { browser: 'chromium' },
      { browser: 'firefox' },
      { browser: 'webkit' },
    ],
    api: {
      // By default the server can listen only on ::1, the first address of localhost.
      // Firefox can connect to 127.0.0.1 instead, and its page.goto fails
      // with NS_ERROR_CONNECTION_REFUSED
      host: '127.0.0.1',
      port,
    },
  }
}
