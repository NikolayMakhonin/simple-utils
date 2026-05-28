import { defineConfig, mergeConfig } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'
import { preview } from '@vitest/browser-preview'
import configBase from './vite.config'

export default defineConfig(env =>
  mergeConfig(configBase(env), {
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
            include: [
              '**/*.{test,node}.{js,ts}',
              '!**/*.{browser,perf,manual,api,e2e}.{js,ts}',
              '!src/browser/**',
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
            include: [
              '**/*.{test,browser}.{js,ts}',
              '!**/*.{node,perf,manual,api,e2e}.{js,ts}',
              '!src/node/**',
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
            include: [
              '**/*.chrome.{js,ts}',
              '!**/*.{node,perf,manual,api,e2e}.{js,ts}',
              '!src/node/**',
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
