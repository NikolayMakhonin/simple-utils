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
    optimizeDeps: {
      // Prevent playwright error: Could not resolve "chromium-bidi/lib/cjs/bidiMapper/BidiMapper"
      // @see https://github.com/microsoft/playwright/issues/33031#issuecomment-2405403388
      exclude: ['chromium-bidi'],
    },
    test: {
      include: [
        '**/*.{test,node,browser,chrome,perf,manual,stress,api,e2e}.{js,ts}',
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

      // poolOptions: {
      //   forks: {
      //     execArgv: [
      //       // '--report-on-fatalerror',
      //       // '--heap-prof',
      //       // '--heap-prof-interval=512',
      //     ],
      //   },
      // },
    },
  }
})
