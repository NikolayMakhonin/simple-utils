import { describe, it, expect } from 'vitest'
import {
  loadGlobs,
  loadGlobsFromFile,
  type Glob,
  type LoadGlobsOptions,
} from './loadGlobs'

describe('loadGlobs - New Exclude Syntax Implementation', () => {
  describe('loadGlobsFromFile', () => {
    it('should load basic glob patterns from file', async () => {
      const result = await loadGlobsFromFile(
        `${__dirname}/-test/-res/loadGlobs/globs.txt`,
      )

      expect(result).toContain('*.js')
      expect(result).toContain('*.ts')
      expect(result).toContain('!node_modules')
      expect(result).toContain('dist/')
      expect(result).toContain('build/')
      expect(result).toContain('src/**/*.test.js')
    })

    it('should handle empty files', async () => {
      const result = await loadGlobsFromFile(
        `${__dirname}/-test/-res/loadGlobs/empty.txt`,
      )
      expect(result).toEqual([])
    })

    it('should ignore comments and empty lines', async () => {
      const result = await loadGlobsFromFile(
        `${__dirname}/-test/-res/loadGlobs/globs.txt`,
      )

      // Should not contain comment lines
      expect(result.some(glob => glob.includes('#'))).toBe(false)
      expect(result.some(glob => glob.trim() === '')).toBe(false)
    })

    it('should trim whitespace from patterns', async () => {
      const result = await loadGlobsFromFile(
        `${__dirname}/-test/-res/loadGlobs/whitespace.txt`,
      )

      // All patterns should be properly trimmed
      result.forEach(pattern => {
        expect(pattern).toBe(pattern.trim())
      })
    })
  })

  describe('Pattern Type: pattern', () => {
    describe('exclude: false (basic include patterns)', () => {
      it('should return patterns as-is for exclude: false', async () => {
        const globs: Glob[] = [
          { value: '*.js', valueType: 'pattern', exclude: false },
          { value: '*.ts', valueType: 'pattern', exclude: false },
          { value: 'src/**/*.jsx', valueType: 'pattern', exclude: false },
        ]
        const result = await loadGlobs({ globs })

        expect(result).toEqual(['*.js', '*.ts', 'src/**/*.jsx'])
      })

      it('should handle negation patterns with exclude: false', async () => {
        const globs: Glob[] = [
          { value: '!*.test.js', valueType: 'pattern', exclude: false },
          { value: '!node_modules/**', valueType: 'pattern', exclude: false },
        ]
        const result = await loadGlobs({ globs })

        expect(result).toEqual(['!*.test.js', '!node_modules/**'])
      })
    })

    describe('exclude: true (^ prefix patterns)', () => {
      it('should add ^ prefix for simple patterns with exclude: true', async () => {
        const globs: Glob[] = [
          { value: '*.test.js', valueType: 'pattern', exclude: true },
          { value: 'node_modules/**', valueType: 'pattern', exclude: true },
          { value: 'dist/', valueType: 'pattern', exclude: true },
        ]
        const result = await loadGlobs({ globs })

        expect(result).toEqual(['^*.test.js', '^node_modules/**', '^dist/'])
      })

      it('should handle negation patterns with exclude: true (creating ^! patterns)', async () => {
        const globs: Glob[] = [
          { value: '!*.test.js', valueType: 'pattern', exclude: true },
          { value: '!important.log', valueType: 'pattern', exclude: true },
        ]
        const result = await loadGlobs({ globs })

        expect(result).toEqual(['^!*.test.js', '^!important.log'])
      })

      it('should handle mixed exclude and include patterns', async () => {
        const globs: Glob[] = [
          { value: '*.js', valueType: 'pattern', exclude: false },
          { value: '*.test.js', valueType: 'pattern', exclude: true },
          { value: '!node_modules/**', valueType: 'pattern', exclude: false },
          { value: '!important.js', valueType: 'pattern', exclude: true },
        ]
        const result = await loadGlobs({ globs })

        expect(result).toEqual([
          '*.js',
          '^*.test.js',
          '!node_modules/**',
          '^!important.js',
        ])
      })
    })
  })

  describe('Pattern Type: file-contains-patterns', () => {
    describe('exclude: false (basic file loading)', () => {
      it('should load patterns from file with relative paths and exclude: false', async () => {
        const globs: Glob[] = [
          {
            value: '-test/-res/loadGlobs/globs.txt',
            valueType: 'file-contains-patterns',
            exclude: false,
          },
        ]
        const options: LoadGlobsOptions = {
          rootDir: __dirname,
          globs,
        }
        const result = await loadGlobs(options)

        expect(result).toContain('-test/-res/loadGlobs/**/*.js')
        expect(result).toContain('-test/-res/loadGlobs/**/*.ts')
        expect(result).toContain('!-test/-res/loadGlobs/**/node_modules')
        expect(result).toContain('-test/-res/loadGlobs/**/dist/')
        expect(result).toContain('-test/-res/loadGlobs/**/build/')
        expect(result).toContain('-test/-res/loadGlobs/**/src/**/*.test.js')
      })

      it('should handle multiple file-contains-patterns sources', async () => {
        const globs: Glob[] = [
          {
            value: '-test/-res/loadGlobs/globs.txt',
            valueType: 'file-contains-patterns',
            exclude: false,
          },
          {
            value: '-test/-res/loadGlobs/whitespace.txt',
            valueType: 'file-contains-patterns',
            exclude: false,
          },
        ]
        const options: LoadGlobsOptions = {
          rootDir: __dirname,
          globs,
        }
        const result = await loadGlobs(options)

        // Should contain patterns from both files
        expect(result.length).toBeGreaterThan(6) // More than just the first file
        expect(result).toContain('-test/-res/loadGlobs/**/*.js')
        expect(result).toContain('-test/-res/loadGlobs/**/*.ts')
      })
    })

    describe('exclude: true (^ prefix for all patterns)', () => {
      it('should add ^ prefix to all patterns loaded from file when exclude: true', async () => {
        const globs: Glob[] = [
          {
            value: '-test/-res/loadGlobs/globs.txt',
            valueType: 'file-contains-patterns',
            exclude: true,
          },
        ]
        const options: LoadGlobsOptions = {
          rootDir: __dirname,
          globs,
        }
        const result = await loadGlobs(options)

        expect(result).toContain('^-test/-res/loadGlobs/**/*.js')
        expect(result).toContain('^-test/-res/loadGlobs/**/*.ts')
        expect(result).toContain('^!-test/-res/loadGlobs/**/node_modules') // Note: ^! prefix for negation patterns
        expect(result).toContain('^-test/-res/loadGlobs/**/dist/')
        expect(result).toContain('^-test/-res/loadGlobs/**/build/')
        expect(result).toContain('^-test/-res/loadGlobs/**/src/**/*.test.js')
      })

      it('should handle nested directory file patterns with exclude: true', async () => {
        const globs: Glob[] = [
          {
            value: '-test/-res/loadGlobs/subdir/nested.txt',
            valueType: 'file-contains-patterns',
            exclude: true,
          },
        ]
        const options: LoadGlobsOptions = {
          rootDir: __dirname,
          globs,
        }
        const result = await loadGlobs(options)

        expect(result).toContain('^-test/-res/loadGlobs/subdir/**/*.test.js')
        expect(result).toContain('^-test/-res/loadGlobs/subdir/**/coverage/')
      })
    })
  })

  describe('Mixed Pattern Types and Complex Scenarios', () => {
    it('should handle mixed pattern and file-contains-patterns with different exclude values', async () => {
      const globs: Glob[] = [
        { value: '*.jsx', valueType: 'pattern', exclude: false },
        {
          value: '-test/-res/loadGlobs/globs.txt',
          valueType: 'file-contains-patterns',
          exclude: false,
        },
        { value: 'tmp/**', valueType: 'pattern', exclude: true },
        { value: '!important.tmp', valueType: 'pattern', exclude: true },
      ]
      const options: LoadGlobsOptions = {
        rootDir: __dirname,
        globs,
      }
      const result = await loadGlobs(options)

      expect(result).toContain('*.jsx')
      expect(result).toContain('^tmp/**')
      expect(result).toContain('^!important.tmp')
      expect(result).toContain('-test/-res/loadGlobs/**/*.js')
      expect(result).toContain('-test/-res/loadGlobs/**/*.ts')
      expect(result).toContain('!-test/-res/loadGlobs/**/node_modules')
    })

    it('should handle all four syntax combinations: glob, !glob, ^glob, ^!glob', async () => {
      const globs: Glob[] = [
        { value: '*.js', valueType: 'pattern', exclude: false }, // glob
        { value: '!*.test.js', valueType: 'pattern', exclude: false }, // !glob
        { value: '*.spec.js', valueType: 'pattern', exclude: true }, // ^glob
        { value: '!important.spec.js', valueType: 'pattern', exclude: true }, // ^!glob
      ]
      const result = await loadGlobs({ globs })

      expect(result).toEqual([
        '*.js', // glob
        '!*.test.js', // !glob
        '^*.spec.js', // ^glob
        '^!important.spec.js', // ^!glob
      ])
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should return empty array when no globs provided', async () => {
      const result = await loadGlobs({})
      expect(result).toEqual([])
    })

    it('should return empty array when globs array is empty', async () => {
      const result = await loadGlobs({ globs: [] })
      expect(result).toEqual([])
    })

    it('should ignore globs with empty values', async () => {
      const globs: Glob[] = [
        { value: '', valueType: 'pattern', exclude: false },
        { value: '*.js', valueType: 'pattern', exclude: false },
        { value: '', valueType: 'file-contains-patterns', exclude: false },
        { value: '*.ts', valueType: 'pattern', exclude: true },
      ]
      const result = await loadGlobs({ globs })

      expect(result).toEqual(['*.js', '^*.ts'])
    })

    it('should handle empty files gracefully', async () => {
      const globs: Glob[] = [
        {
          value: '-test/-res/loadGlobs/empty.txt',
          valueType: 'file-contains-patterns',
          exclude: false,
        },
        { value: '*.js', valueType: 'pattern', exclude: false },
      ]
      const options: LoadGlobsOptions = {
        rootDir: __dirname,
        globs,
      }
      const result = await loadGlobs(options)

      expect(result).toEqual(['*.js'])
    })

    it('should handle files with only comments', async () => {
      const globs: Glob[] = [
        {
          value: '-test/-res/loadGlobs/comments-only.txt',
          valueType: 'file-contains-patterns',
          exclude: false,
        },
        { value: '*.ts', valueType: 'pattern', exclude: false },
      ]
      const options: LoadGlobsOptions = {
        rootDir: __dirname,
        globs,
      }
      const result = await loadGlobs(options)

      expect(result).toEqual(['*.ts'])
    })

    it('should use current directory as default rootDir', async () => {
      const globs: Glob[] = [
        { value: '*.js', valueType: 'pattern', exclude: false },
      ]
      const result = await loadGlobs({ globs })

      expect(result).toEqual(['*.js'])
    })

    it('should handle null rootDir', async () => {
      const globs: Glob[] = [
        { value: '*.js', valueType: 'pattern', exclude: false },
      ]
      const options: LoadGlobsOptions = {
        rootDir: null,
        globs,
      }
      const result = await loadGlobs(options)

      expect(result).toEqual(['*.js'])
    })
  })

  describe('Backward Compatibility Validation', () => {
    it('should maintain behavior for old-style patterns (exclude property)', async () => {
      // Test that the exclude property works as expected instead of old revert property
      const globs: Glob[] = [
        { value: '*.js', valueType: 'pattern', exclude: false },
        { value: 'node_modules/**', valueType: 'pattern', exclude: true },
      ]
      const result = await loadGlobs({ globs })

      expect(result).toEqual(['*.js', '^node_modules/**'])
    })

    it('should validate that exclude property is used instead of revert', async () => {
      // This test ensures exclude property exists and works
      const globs: Glob[] = [
        { value: '*.test.js', valueType: 'pattern', exclude: true },
        { value: '!important.test.js', valueType: 'pattern', exclude: true },
      ]
      const result = await loadGlobs({ globs })

      expect(result).toEqual(['^*.test.js', '^!important.test.js'])
    })
  })

  describe('Real-world Scenarios', () => {
    it('should handle typical .gitignore-style patterns with exclude syntax', async () => {
      const globs: Glob[] = [
        // Include everything
        { value: '**/*', valueType: 'pattern', exclude: false },

        // Exclude common directories (using exclude: true for ^ syntax)
        { value: 'node_modules/**', valueType: 'pattern', exclude: true },
        { value: '.git/**', valueType: 'pattern', exclude: true },
        { value: 'dist/**', valueType: 'pattern', exclude: true },

        // But include specific files (using exclude: true with ! for ^! syntax)
        { value: '!dist/important.js', valueType: 'pattern', exclude: true },

        // Regular negation patterns
        { value: '!*.log', valueType: 'pattern', exclude: false },
        { value: '!.env*', valueType: 'pattern', exclude: false },
      ]
      const result = await loadGlobs({ globs })

      expect(result).toEqual([
        '**/*', // include all
        '^node_modules/**', // exclude node_modules
        '^.git/**', // exclude .git
        '^dist/**', // exclude dist
        '^!dist/important.js', // but include this specific file (remove exclusion)
        '!*.log', // ignore log files
        '!.env*', // ignore env files
      ])
    })

    it('should handle complex project structure with mixed patterns', async () => {
      const globs: Glob[] = [
        {
          value: 'src/**/*.{js,ts,jsx,tsx}',
          valueType: 'pattern',
          exclude: false,
        },
        { value: '*.test.*', valueType: 'pattern', exclude: true },
        { value: '*.spec.*', valueType: 'pattern', exclude: true },
        { value: '!src/test-utils/**', valueType: 'pattern', exclude: true }, // ^!pattern
        { value: 'coverage/**', valueType: 'pattern', exclude: true },
      ]
      const result = await loadGlobs({ globs })

      expect(result).toEqual([
        'src/**/*.{js,ts,jsx,tsx}',
        '^*.test.*',
        '^*.spec.*',
        '^!src/test-utils/**',
        '^coverage/**',
      ])
    })
  })

  describe('File Path Resolution', () => {
    it('should correctly resolve relative paths from rootDir', async () => {
      const globs: Glob[] = [
        {
          value: '-test/-res/loadGlobs/globs.txt',
          valueType: 'file-contains-patterns',
          exclude: false,
        },
      ]
      const options: LoadGlobsOptions = {
        rootDir: __dirname,
        globs,
      }
      const result = await loadGlobs(options)

      // All patterns should be prefixed with the relative path
      result.forEach(pattern => {
        if (!pattern.startsWith('!') && !pattern.startsWith('^')) {
          expect(pattern.startsWith('-test/-res/loadGlobs/')).toBe(true)
        }
      })
    })
  })
})
