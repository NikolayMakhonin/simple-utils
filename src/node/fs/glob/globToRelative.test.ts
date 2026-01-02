/**
 * Tests glob pattern conversion to relative paths
 * WHY: Tests glob pattern conversion from .gitignore patterns to relative directory patterns
 */

import { describe, it, expect } from 'vitest'
import { globToRelative } from './globToRelative'

describe('globToRelative', () => {
  describe('when relativePath is empty or current directory', () => {
    it('should return original glob for empty relativePath', () => {
      expect(globToRelative('*.js', '')).toBe('*.js')
    })

    it('should return original glob for current directory', () => {
      expect(globToRelative('*.js', '.')).toBe('*.js')
    })
  })

  describe('when glob starts with /', () => {
    it('should prepend relativePath to absolute glob', () => {
      expect(globToRelative('/dist', 'src')).toBe('src/dist')
    })

    it('should handle relativePath with trailing slash', () => {
      expect(globToRelative('/dist', 'src/')).toBe('src/dist')
    })

    it('should handle multiple levels', () => {
      expect(globToRelative('/node_modules', 'app/src')).toBe(
        'app/src/node_modules',
      )
    })
  })

  describe('when glob starts with ./', () => {
    it('should replace ./ with relativePath', () => {
      expect(globToRelative('./build', 'src')).toBe('src/build')
    })

    it('should handle nested paths', () => {
      expect(globToRelative('./dist/bundle.js', 'app/src')).toBe(
        'app/src/dist/bundle.js',
      )
    })
  })

  describe('when glob starts with ../', () => {
    it('should prepend relativePath to parent reference', () => {
      expect(globToRelative('../config', 'src/utils')).toBe('src/config')
    })

    it('should handle multiple parent references', () => {
      expect(globToRelative('../../global.css', 'src/components')).toBe(
        'global.css',
      )
    })
  })

  describe('when glob starts with **', () => {
    it('should prepend relativePath to recursive glob', () => {
      expect(globToRelative('**/*.js', 'src')).toBe('src/**/*.js')
    })

    it('should handle specific recursive patterns', () => {
      expect(globToRelative('**/node_modules', 'app')).toBe(
        'app/**/node_modules',
      )
    })
  })

  describe('when glob is a simple pattern', () => {
    it('should add /**/  between relativePath and glob', () => {
      expect(globToRelative('*.js', 'src')).toBe('src/**/*.js')
    })

    it('should handle file extensions', () => {
      expect(globToRelative('*.ts', 'lib/utils')).toBe('lib/utils/**/*.ts')
    })

    it('should handle directory names', () => {
      expect(globToRelative('node_modules', 'src')).toBe('src/**/node_modules')
    })
  })

  describe('when glob has negation prefix !', () => {
    it('should preserve negation for absolute paths', () => {
      expect(globToRelative('!/dist', 'src')).toBe('!src/dist')
    })

    it('should preserve negation for relative paths', () => {
      expect(globToRelative('!./build', 'src')).toBe('!src/build')
    })

    it('should preserve negation for simple patterns', () => {
      expect(globToRelative('!*.log', 'src')).toBe('!src/**/*.log')
    })

    it('should preserve negation for parent references', () => {
      expect(globToRelative('!../config', 'src')).toBe('!config')
    })

    it('should preserve negation for recursive patterns', () => {
      expect(globToRelative('!**/*.test.js', 'src')).toBe('!src/**/*.test.js')
    })
  })

  describe('path normalization', () => {
    it('should normalize paths with multiple slashes', () => {
      expect(globToRelative('/dist', 'src//utils')).toBe('src/utils/dist')
    })

    it('should handle backslashes on Windows-style paths', () => {
      expect(globToRelative('/dist', 'src\\utils')).toBe('src/utils/dist')
    })

    it('should normalize complex relative paths', () => {
      expect(globToRelative('../config', 'src/./utils')).toBe('src/config')
    })
  })

  describe('edge cases', () => {
    it('should handle empty glob', () => {
      expect(globToRelative('', 'src')).toBe('src/**/')
    })

    it('should handle glob with only negation', () => {
      expect(globToRelative('!', 'src')).toBe('!src/**/')
    })

    it('should handle relativePath with complex nesting', () => {
      expect(globToRelative('*.js', 'a/b/c/d')).toBe('a/b/c/d/**/*.js')
    })
  })
})
