import { defineConfig } from 'vitest/config'
import { createLogger, loadEnv } from 'vite'
import dts from 'vite-plugin-dts'
import path from 'path'

const logger = createLogger()
const originalWarn = logger.warn
logger.warn = (message, ...args) => {
  // if (/...example.../.test(message)) {
  //  return
  // }
  // Function('debugger')()
  originalWarn(message, ...args)
}

export default defineConfig(({ mode, isSsrBuild, command }) => {
  return {
    plugins: [
      dts({
        // Without path.resolve of vite aliases the dts plugin will not work
        rollupTypes: false,
        include: ['src/**/*.ts'],
        exclude: ['**/*.{test,node,browser,perf,manual,api,e2e}.ts'],
        insertTypesEntry: true,
        staticImport: true,
      }),
    ],
    resolve: {
      alias: {
        src: path.resolve('src'),
      },
      // see: https://svelte.dev/docs/svelte/testing#Unit-and-integration-testing-using-Vitest
      ...(process.env.VITEST ? { conditions: ['browser'] } : undefined),
    },
    build: {
      // minify: mode === 'production',
      // minify: false,
      lib: {
        entry: {
          'common/index': 'src/common/index.ts',
          'node/index': 'src/node/index.ts',
          'browser/index': 'src/browser/index.ts',
        },
      },
      rollupOptions: {
        external: ['rdtsc/node'],
        output: [
          {
            format: 'es',
            entryFileNames: '[name].mjs',
          },
          {
            format: 'cjs',
            entryFileNames: '[name].cjs',
          },
        ],
      },
      target: 'node20',
      minify: true,
      sourcemap: false,
      outDir: 'build',
      ssr: true,
    },
    customLogger: logger,
    test: {
      include: [
        '**/*.{test,node,perf,manual,api,e2e}.{js,ts}',
        '!**/{tmp,temp,-tmp,-temp}/**',
        '!./*.ts',
      ],
      testTimeout: 10000,
      hookTimeout: 10000,

      // docs: https://vitest.dev/guide/features.html#environment-variables
      // env: loadEnv(mode, process.cwd(), ''),

      coverage: {
        provider: 'v8',
        include: ['src/**'],
        // vitest исключает файлы тестов, принудитеьно возвращаем их обратно
        exclude: [
          '!**/*.{test,node,browser,perf,manual,api,e2e}.{js,ts}',
          '**/{tmp,temp,-tmp,-temp}/**',
        ],
        extension: ['.js', '.ts'],
        all: true,
        clean: true,
        cleanOnRerun: true,
        reportOnFailure: true,
      },

      // It doesn't work at all: https://github.com/vitest-dev/vitest/issues/3434
      // docs: https://vitest.dev/guide/browser.html
      // browser: {
      //   name: 'chromium',
      //   enabled: true,
      //   provider: 'playwright',
      //   headless: true,
      // },
    },
  }
})
