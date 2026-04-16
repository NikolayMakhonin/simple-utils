import js from '@eslint/js'
import ts from 'typescript-eslint'
import prettierConfig from 'eslint-config-prettier'
import jsoncPlugin from 'eslint-plugin-jsonc'
import globals from 'globals'
import { FlatCompat } from '@eslint/eslintrc'
import { includeIgnoreFile } from '@eslint/compat'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const gitIgnorePath = path.resolve(__dirname, '.gitignore')
const eslintIgnorePath = path.resolve(__dirname, 'eslintignore')

const compat = new FlatCompat({
  baseDirectory: __dirname,
})

export default ts.config([
  includeIgnoreFile(gitIgnorePath),
  includeIgnoreFile(eslintIgnorePath),

  js.configs.recommended,
  prettierConfig,

  ...compat.extends('plugin:prettier/recommended', 'plugin:jsonc/prettier'),

  {
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      parserOptions: {
        extraFileExtensions: ['.svelte'],
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },

    rules: {
      semi: ['error', 'never'],
      'comma-dangle': ['error', 'always-multiline'],
      'prettier/prettier': 'warn',
      'no-unsafe-finally': 'off',
      'prefer-rest-params': 'off',
      'no-constant-condition': 'off',
      'prefer-const': 'warn',
      'no-control-regex': 'warn',
      'no-useless-escape': 'warn',
      'no-empty-pattern': 'off',
      'no-constant-binary-expression': 'off',
    },
  },

  {
    files: ['**/*.cjs', '**/*.mjs', '**/*.js'],
    rules: {
      '@/no-var-requires': 'off',
    },
  },

  {
    files: ['**/*.ts', '**/*.tsx'],
    extends: ts.configs.recommended,
    // docs: https://typescript-eslint.io/rules/
    rules: {
      '@/semi': ['error', 'never'],
      '@/comma-dangle': [
        'error',
        {
          functions: 'always-multiline',
          imports: 'always-multiline',
          exports: 'always-multiline',
          objects: 'always-multiline',
          arrays: 'always-multiline',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-inferrable-types': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-this-alias': 'off',
      '@typescript-eslint/prefer-as-const': 'off',
      '@typescript-eslint/ban-types': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
    },
  },

  {
    files: [
      '**/*.test.*',
      '**/*.perf.*',
      '**/*.chrome.*',
      '**/*.api.*',
      '**/*.e2e.*',
      '**/*.config.*',
      '**/*.*.*',
    ],
    rules: {
      '@/no-unused-vars': 'off',
    },
  },

  {
    files: ['**/*.json', '**/*.json5', '**/*.jsonc'],
    plugins: {
      jsonc: jsoncPlugin,
    },
    languageOptions: {
      parser: jsoncPlugin,
    },
  },

  {
    files: ['**/-dev/**'],
    rules: {
      '@/no-unused-vars': 'off',
    },
  },
])
