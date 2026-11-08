import { defineConfig, mergeConfig } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'
import { preview } from '@vitest/browser-preview'
import configBase from './vite.config'

export default defineConfig(env =>
  mergeConfig(configBase(env), {
    test: {
      // Each project extends the base include, which lists every test suffix,
      // so its exclude must list every suffix except its own
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
            exclude: [
              '**/*.{browser,chrome,perf,manual,stress,api,e2e}.{js,ts}',
              'src/browser/**',
            ],
          },
        },
        {
          extends: true,
          resolve: {
            conditions: ['node'],
          },
          test: {
            name: {
              label: 'stress',
            },
            exclude: [
              '**/*.{test,node,browser,chrome,perf,manual,api,e2e}.{js,ts}',
              'src/browser/**',
            ],
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
            exclude: [
              '**/*.{node,chrome,perf,manual,stress,api,e2e}.{js,ts}',
              'src/node/**',
            ],
            browser: {
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
                // By default the server listens on the first address of localhost,
                // which can be ::1, while Firefox sometimes connects through 127.0.0.1
                // only: its page.goto then fails with NS_ERROR_CONNECTION_REFUSED
                host: '127.0.0.1',
                port: 4001,
              },
            },
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
            exclude: [
              '**/*.{test,node,browser,perf,manual,stress,api,e2e}.{js,ts}',
              'src/node/**',
            ],
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
  }),
)
