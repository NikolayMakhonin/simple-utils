import { configDefaults, defineConfig } from 'vitest/config'
import { createLogger, loadEnv } from 'vite'
import dts from 'vite-plugin-dts'
import path from 'path'
import { builtinModules } from 'module'
import pkg from './package.json' with { type: 'json' }

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
        exclude: [
          '**/*.{test,node,browser,chrome}.ts',
          '**/*.e2e.{slow,long,manual}.ts',
          '**/-test/**',
        ],
        insertTypesEntry: true,
        staticImport: true,
      }),
    ],
    resolve: {
      alias: {
        src: path.resolve('src'),
      },
    },
    base: './',
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
        // Without it, the cjs build turns import.meta.url into undefined.
        // createWorkerVite passes import.meta.url to new URL(), which throws for undefined
        platform: 'node',
        external: [
          ...builtinModules,
          ...builtinModules.map(m => `node:${m}`),
          ...Object.keys(pkg.dependencies),
        ],
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
      assetsInlineLimit: () => false,
      emitAssets: true,
    },
    assetsInclude: ['**/-res/**/*.mjs'],
    customLogger: logger,
    optimizeDeps: {
      // Prevent playwright error: Could not resolve "chromium-bidi/lib/cjs/bidiMapper/BidiMapper"
      // @see https://github.com/microsoft/playwright/issues/33031#issuecomment-2405403388
      exclude: ['chromium-bidi'],
    },
    test: {
      // Exclusions are in exclude, not negated patterns here: vitest adds include
      // to coverage.exclude. In coverage.exclude, '!**/tmp/**' excludes every file outside tmp
      include: [
        '**/*.{test,node,browser,chrome}.{js,ts}',
        '**/*.e2e.{slow,long,manual}.{js,ts}',
      ],
      exclude: [
        ...configDefaults.exclude,
        '**/{tmp,temp,-tmp,-temp}/**',
        './*.ts',
      ],
      testTimeout: 10000,
      hookTimeout: 10000,

      // docs: https://vitest.dev/guide/features.html#environment-variables
      // env: loadEnv(mode, process.cwd(), ''),

      coverage: {
        provider: 'v8',
        include: ['src/**'],
        // Test files cannot be included: vitest adds test.include to coverage.exclude.
        // A negated pattern like '!**/*.test.ts' here would exclude every other file
        // see: https://github.com/vitest-dev/vitest/commit/b5268965
        exclude: ['**/{tmp,temp,-tmp,-temp}/**'],
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
