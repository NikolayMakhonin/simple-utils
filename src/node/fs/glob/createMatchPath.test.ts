import { describe, it, expect } from 'vitest'
import { createMatchPath } from './createMatchPath'

describe('createMatchPath - Invalid Pattern Validation', () => {
  describe('Invalid Glob Pattern Detection', () => {
    it('should throw error for unclosed bracket patterns', () => {
      expect(() => {
        createMatchPath({ globs: ['['] })
      }).toThrow(/Invalid glob pattern: "\["/)
    })

    it('should throw error for complex unclosed bracket patterns', () => {
      expect(() => {
        createMatchPath({ globs: ['**['] })
      }).toThrow(/Invalid glob pattern: "\*\*\["/)
    })

    it('should handle single backslash patterns (may not throw depending on picomatch version)', () => {
      // Single backslash may be handled differently by picomatch versions
      // This test documents current behavior - adjust expectation if needed
      expect(() => {
        const matchPath = createMatchPath({ globs: ['\\'] })
        // If no error thrown, verify it creates a working matcher
        expect(typeof matchPath).toBe('function')
      }).not.toThrow()
    })

    it('should allow valid bracket patterns', () => {
      expect(() => {
        createMatchPath({ globs: ['[abc]', '*.{js,ts}', '[0-9]*'] })
      }).not.toThrow()
    })

    it('should provide helpful error messages for invalid patterns', () => {
      expect(() => {
        createMatchPath({ globs: ['[unclosed'] })
      }).toThrow(/Valid glob patterns use.*properly closed and balanced/)
    })
  })
})

describe('createMatchPath - New Syntax Implementation', () => {
  describe('Basic Pattern Types', () => {
    describe('Simple Include Patterns (glob)', () => {
      it('should include files matching simple patterns', () => {
        const matchPath = createMatchPath({ globs: ['*.js'] })

        expect(matchPath('file.js')).toBe(true)
        expect(matchPath('script.js')).toBe(true)
        expect(matchPath('src/component.js')).toBe(null)
        expect(matchPath('file.ts')).toBe(null)
        expect(matchPath('file.txt')).toBe(null)
      })

      it('should handle multiple include patterns', () => {
        const matchPath = createMatchPath({ globs: ['*.js', '*.ts'] })

        expect(matchPath('file.js')).toBe(true)
        expect(matchPath('script.ts')).toBe(true)
        expect(matchPath('src/component.js')).toBe(null)
        expect(matchPath('src/helper.ts')).toBe(null)
        expect(matchPath('file.txt')).toBe(null)
      })
    })

    describe('Negation Patterns (!glob)', () => {
      it('should exclude files matching negation patterns when already included', () => {
        const matchPath = createMatchPath({ globs: ['*.js', '!*.test.js'] })

        expect(matchPath('file.js')).toBe(true)
        expect(matchPath('component.js')).toBe(true)
        expect(matchPath('file.test.js')).toBe(false)
        expect(matchPath('component.test.js')).toBe(false)
        expect(matchPath('file.ts')).toBe(null) // not included by any pattern
      })

      it('should set include=false when negation pattern matches without prior include', () => {
        const matchPath = createMatchPath({ globs: ['!*.test.js'] })

        expect(matchPath('file.test.js')).toBe(false)
        expect(matchPath('component.test.js')).toBe(false)
        expect(matchPath('file.js')).toBe(null) // no include pattern
      })

      it('should handle complex negation scenarios', () => {
        const matchPath = createMatchPath({
          globs: ['**/*', '!node_modules/**', '!*.log'],
        })

        expect(matchPath('src/file.js')).toBe(true)
        expect(matchPath('lib/helper.ts')).toBe(true)
        expect(matchPath('node_modules/package/index.js')).toBe(false)
        expect(matchPath('debug.log')).toBe(false)
        expect(matchPath('src/debug.log')).toBe(true)
      })
    })

    describe('Exclude Patterns (^glob)', () => {
      it('should exclude files when they are already included', () => {
        const matchPath = createMatchPath({ globs: ['*.js', '^*.test.js'] })

        expect(matchPath('file.js')).toBe(true)
        expect(matchPath('component.js')).toBe(true)
        expect(matchPath('file.test.js')).toBe(false) // included by *.js, then excluded by ^*.test.js
        expect(matchPath('component.test.js')).toBe(false)
        expect(matchPath('file.ts')).toBe(null) // never included
      })

      it('should NOT affect files that are not already included', () => {
        const matchPath = createMatchPath({ globs: ['^*.test.js'] })

        expect(matchPath('file.test.js')).toBe(false) // not included first, so exclude has no effect
        expect(matchPath('file.js')).toBe(null)
      })

      it('should work with complex include/exclude scenarios', () => {
        const matchPath = createMatchPath({
          globs: ['src/**/*', '^src/test/**', '^src/**/*.spec.js'],
        })

        expect(matchPath('src/components/Button.js')).toBe(true)
        expect(matchPath('src/utils/helper.ts')).toBe(true)
        expect(matchPath('src/test/setup.js')).toBe(false) // excluded by ^src/test/**
        expect(matchPath('src/components/Button.spec.js')).toBe(false) // excluded by ^src/**/*.spec.js
        expect(matchPath('lib/helper.js')).toBe(null) // never included
      })
    })

    describe('Exclude Negation Patterns (^!glob)', () => {
      it('should remove exclusion when pattern matches and file was included', () => {
        const matchPath = createMatchPath({
          globs: ['src/**/*', '^src/test/**', '^!src/test/important.js'],
        })

        expect(matchPath('src/components/Button.js')).toBe(true)
        expect(matchPath('src/test/setup.js')).toBe(false) // excluded by ^src/test/**
        expect(matchPath('src/test/helper.js')).toBe(false) // excluded by ^src/test/**
        expect(matchPath('src/test/important.js')).toBe(true) // exclusion removed by ^!src/test/important.js
      })

      it('should only work when file was previously included', () => {
        const matchPath = createMatchPath({
          globs: ['^!src/test/important.js'],
        })

        expect(matchPath('src/test/important.js')).toBe(null) // never included first
      })

      it('should handle complex scenarios with multiple exclusions and removals', () => {
        const matchPath = createMatchPath({
          globs: [
            '**/*', // include all
            '^node_modules/**', // exclude node_modules
            '^dist/**', // exclude dist
            '^!dist/important.js', // but include dist/important.js
            '^!node_modules/keep/**', // but include node_modules/keep/**
          ],
        })

        expect(matchPath('src/file.js')).toBe(true)
        expect(matchPath('node_modules/package/index.js')).toBe(false)
        expect(matchPath('node_modules/keep/special.js')).toBe(true) // exclusion removed
        expect(matchPath('dist/bundle.js')).toBe(false)
        expect(matchPath('dist/important.js')).toBe(true) // exclusion removed
      })
    })
  })

  describe('Invalid Syntax', () => {
    it('should throw error for !^glob patterns', () => {
      expect(() => {
        createMatchPath({ globs: ['!^*.js'] })
      }).toThrow('Invalid glob pattern')
    })

    it('should throw error for patterns starting with ^^', () => {
      expect(() => {
        createMatchPath({ globs: ['^^*.js'] })
      }).toThrow('Invalid glob pattern')
    })

    it('should throw error for patterns starting with !!', () => {
      expect(() => {
        createMatchPath({ globs: ['!!*.js'] })
      }).toThrow('Invalid glob pattern')
    })
  })

  describe('Pattern Precedence and Order', () => {
    it('should process patterns in order with later patterns overriding earlier ones', () => {
      const matchPath = createMatchPath({
        globs: ['*.js', '!*.test.js', '*.test.js'],
      })

      // First included by *.js, then excluded by !*.test.js, then included again by *.test.js
      expect(matchPath('file.test.js')).toBe(true)
    })

    it('should handle complex precedence with exclude patterns', () => {
      const matchPath = createMatchPath({
        globs: [
          'src/**/*',
          '^src/test/**',
          'src/test/keep.js',
          '^src/test/keep.js',
        ],
      })

      expect(matchPath('src/components/Button.js')).toBe(true)
      expect(matchPath('src/test/setup.js')).toBe(false)
      expect(matchPath('src/test/keep.js')).toBe(false) // included, then excluded again
    })

    it('should handle exclude removal patterns correctly', () => {
      const matchPath = createMatchPath({
        globs: [
          '**/*',
          '^test/**',
          '^!test/important/**',
          '^test/important/secret.js',
        ],
      })

      expect(matchPath('src/file.js')).toBe(true)
      expect(matchPath('test/setup.js')).toBe(false) // excluded
      expect(matchPath('test/important/keep.js')).toBe(true) // exclusion removed
      expect(matchPath('test/important/secret.js')).toBe(false) // exclusion removed, then excluded again
    })
  })

  describe('gitignore-like Behavior Scenarios', () => {
    it('should handle typical .gitignore patterns', () => {
      const matchPath = createMatchPath({
        globs: [
          '**/*', // include everything
          '!node_modules/**', // ignore node_modules
          '!*.log', // ignore log files
          '!dist/**', // ignore dist
          'dist/keep.txt', // but keep this specific file
          '!.env*', // ignore env files
          '.env.example', // but keep the example
        ],
      })

      expect(matchPath('src/index.js')).toBe(true)
      expect(matchPath('README.md')).toBe(true)
      expect(matchPath('node_modules/package/index.js')).toBe(false)
      expect(matchPath('debug.log')).toBe(false)
      expect(matchPath('dist/bundle.js')).toBe(false)
      expect(matchPath('dist/keep.txt')).toBe(true)
      expect(matchPath('.env')).toBe(false)
      expect(matchPath('.env.local')).toBe(false)
      expect(matchPath('.env.example')).toBe(true)
    })

    it('should handle directory vs file patterns correctly', () => {
      const matchPath = createMatchPath({
        globs: ['**/*', '!build/**', 'build/important.txt'],
      })

      expect(matchPath('src/file.js')).toBe(true)
      expect(matchPath('build/output.js')).toBe(false) // directory pattern excludes all contents
      expect(matchPath('build/important.txt')).toBe(true) // but this specific file is re-included
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty glob arrays', () => {
      const matchPath = createMatchPath({ globs: [] })

      expect(matchPath('any-file.js')).toBe(null)
      expect(matchPath('src/component.ts')).toBe(null)
      expect(matchPath('src/')).toBe(null)
      expect(matchPath('src')).toBe(null)
    })

    it('should handle empty strings in globs', () => {
      const matchPath = createMatchPath({ globs: [''] })

      expect(matchPath('any-file.js')).toBe(null)
      expect(matchPath('file.txt')).toBe(null)
    })

    it('should handle only exclude patterns', () => {
      const matchPath = createMatchPath({ globs: ['^*.test.js'] })

      expect(matchPath('file.test.js')).toBe(false) // no include first
      expect(matchPath('file.js')).toBe(null)
    })

    it('should handle only negation patterns', () => {
      const matchPath = createMatchPath({ globs: ['!*.test.js'] })

      expect(matchPath('file.test.js')).toBe(false)
      expect(matchPath('file.js')).toBe(null)
    })

    it('should handle mixed exclude and negation patterns', () => {
      const matchPath = createMatchPath({
        globs: ['**/*', '!temp/**', '^cache/**'],
      })

      expect(matchPath('src/file.js')).toBe(true)
      expect(matchPath('temp/file.js')).toBe(false) // negated
      expect(matchPath('cache/file.js')).toBe(false) // excluded
    })
  })

  describe('Return Value Validation', () => {
    it('should return true for included files', () => {
      const matchPath = createMatchPath({ globs: ['*.js'] })
      expect(matchPath('file.js')).toBe(true)
      expect(typeof matchPath('file.js')).toBe('boolean')
    })

    it('TODO: compose name 1', () => {
      const matchPath = createMatchPath({ globs: ['**/*.js'] })
      expect(matchPath('file.js')).toBe(true)
      expect(matchPath('src/file.js')).toBe(true)
      expect(matchPath('src/')).toBe(null)
      expect(matchPath('src')).toBe(null)
      expect(matchPath('dist/')).toBe(null)
      expect(matchPath('dist')).toBe(null)
    })

    it('TODO: compose name 2', () => {
      const matchPath = createMatchPath({ globs: ['**/*.js'] })
      expect(matchPath('file.js')).toBe(true)
      expect(matchPath('src/file.js')).toBe(true)
      expect(matchPath('src')).toBe(null)
      expect(matchPath('src/')).toBe(null)
      expect(matchPath('dist/')).toBe(null)
      expect(matchPath('dist')).toBe(null)
    })

    it('TODO: compose name 3', () => {
      const matchPath = createMatchPath({ globs: ['!**', '**/*.js'] })
      expect(matchPath('file.js')).toBe(true)
      expect(matchPath('src/file.js')).toBe(true)
      expect(matchPath('src')).toBe(false)
      expect(matchPath('src/')).toBe(false)
      expect(matchPath('dist/')).toBe(false)
      expect(matchPath('dist')).toBe(false)
    })

    it('should return false for excluded files', () => {
      const matchPath = createMatchPath({ globs: ['*.js', '!*.test.js'] })
      expect(matchPath('file.test.js')).toBe(false)
      expect(typeof matchPath('file.test.js')).toBe('boolean')
    })

    it('should return null for unmatched files', () => {
      const matchPath = createMatchPath({ globs: ['*.js'] })
      expect(matchPath('file.ts')).toBe(null)
      expect(matchPath('file.ts')).toBeNull()
    })
  })

  describe('Path Normalization', () => {
    it('should normalize Windows backslashes in paths', () => {
      const matchPath = createMatchPath({
        globs: ['src/**/*.js', '!src/test/**'],
      })

      expect(matchPath('src\\components\\Button.js')).toBe(true)
      expect(matchPath('src\\test\\Button.test.js')).toBe(false)
    })

    it('should normalize backslashes in patterns', () => {
      const matchPath = createMatchPath({
        globs: ['src\\**\\*.js', '!src\\test\\**'],
      })

      expect(matchPath('src/components/Button.js')).toBe(true)
      expect(matchPath('src/test/Button.test.js')).toBe(false)
    })

    it('should handle leading slashes correctly', () => {
      const matchPath = createMatchPath({ globs: ['/src/**/*.js'] })

      expect(matchPath('src/components/Button.js')).toBe(true)
    })
  })

  describe('Case Sensitivity', () => {
    it('should be case sensitive by default', () => {
      const matchPath = createMatchPath({ globs: ['*.JS'] })

      expect(matchPath('file.JS')).toBe(true)
      expect(matchPath('file.js')).toBe(null)
    })

    it('should handle case insensitive matching when noCase is true', () => {
      const matchPath = createMatchPath({ globs: ['*.JS'], noCase: true })

      expect(matchPath('file.JS')).toBe(true)
      expect(matchPath('file.js')).toBe(true)
      expect(matchPath('file.Js')).toBe(true)
    })

    it('should work with case insensitive exclude patterns', () => {
      const matchPath = createMatchPath({
        globs: ['*.js', '^*.TEST.js'],
        noCase: true,
      })

      expect(matchPath('file.js')).toBe(true)
      expect(matchPath('file.test.js')).toBe(false)
      expect(matchPath('file.TEST.js')).toBe(false)
      expect(matchPath('file.Test.js')).toBe(false)
    })
  })

  describe('MASSIVE TESTS', () => {
    function test(glob: string, yes: string[], no: string[]) {
      const match = createMatchPath({ globs: [glob] })
      yes.forEach(_path => {
        const result = match(_path)
        expect(
          result,
          `Pattern "${glob}" should match path "${_path}" but got ${result}`,
        ).toBe(true)
      })
      no.forEach(_path => {
        const result = match(_path)
        expect(
          result,
          `Pattern "${glob}" should NOT match path "${_path}" but got ${result}`,
        ).toBeNull()
      })
    }

    it('single * patterns', () => {
      test('*', ['a', 'b', '1', 'x.js', 'test'], ['a/b', 'x/y', ''])
      test('*.js', ['a.js', 'x.js', '1.js'], ['a.ts', 'a', 'a.js/b'])
      test('*.ts', ['a.ts', 'x.ts', '1.ts'], ['a.js', 'a', 'a.ts/b'])
      test('*a', ['a', 'ba', 'xa', '123a'], ['ab', 'a/b', ''])
      test('a*', ['a', 'ab', 'aaa', 'a123'], ['ba', 'a/b', ''])
      test('*a*', ['a', 'ab', 'ba', 'xax', '123a456'], ['b', 'x', ''])
      test('test*', ['test', 'testing', 'test123'], ['tes', 'atest', 'test/a'])
      test('*test', ['test', 'atest', '123test'], ['testing', 'test/a', ''])
      test(
        '*test*',
        ['test', 'atest', 'testing', 'xtest123'],
        ['tes', 'est', ''],
      )
      test('a/*', ['a/b', 'a/x', 'a/1'], ['a', 'b', 'a/b/c'])
      test('*/b', ['a/b', 'x/b', '1/b'], ['b', 'a', 'a/b/c'])
      test('*/*/c', ['a/b/c', 'x/y/c', '1/2/c'], ['a/c', 'c', 'a/b/c/d'])
      test('a/*/c', ['a/b/c', 'a/x/c', 'a/1/c'], ['a/c', 'b/c', 'a/b/c/d'])
      test('*/*', ['a/b', 'x/y', '1/2'], ['a', 'a/b/c'])
      test('*/*/*', ['a/b/c', 'x/y/z', '1/2/3'], ['a/b', 'a/b/c/d'])
      test(
        '*config*',
        ['config', 'myconfig', 'app.config.js', 'configure'],
        ['src/config'],
      )
      test(
        '*test*',
        ['test', 'mytest', 'component.test.js', 'testing'],
        ['src/test'],
      )
      test(
        '*index*',
        ['index', 'index.js', 'main.index.ts'],
        ['idx', 'src/index'],
      )
    })

    it('double ** patterns', () => {
      test('**', ['a', 'a/b', 'a/b/c', 'x/y/z/w'], [])
      test('**/*', ['a', 'a/b', 'a/b/c', 'x/y/z/w'], [])
      test('**/a', ['a', 'x/a', 'x/y/a', '1/2/3/a'], ['b', 'a/b', 'xa'])
      test('a/**', ['a', 'a/b', 'a/b/c', 'a/x/y/z'], ['b', 'x/a'])
      test(
        '**/a/**',
        ['a/b', 'a/b/c', 'x/a/y', '1/a/2/3', 'a', 'x/a'],
        ['', 'x'],
      )
      test('**/*.js', ['a.js', 'x/a.js', 'x/y/z.js'], ['a.ts', 'a', 'x/a'])
      test('**/*.ts', ['a.ts', 'x/a.ts', 'x/y/z.ts'], ['a.js', 'a', 'x/a'])
      test(
        '**/*.json',
        ['a.json', 'x/a.json', 'x/y/z.json'],
        ['a.js', 'a', 'x/a'],
      )
      test('**/a.js', ['a.js', 'x/a.js', 'x/y/a.js'], ['a.ts', 'b.js', 'a'])
      test(
        '**/test.js',
        ['test.js', 'x/test.js', 'x/y/test.js'],
        ['test.ts', 'a.js', 'test'],
      )
      test(
        '**/config',
        ['config', 'src/config', 'a/b/config'],
        ['configs', 'config/a'],
      )
      test(
        '**/cli.ts',
        ['cli.ts', 'src/cli.ts', 'a/b/cli.ts'],
        ['cli.js', 'cli'],
      )
      test(
        '**/test/**',
        ['test/a', 'src/test/a', 'a/test/b/c', 'test'],
        ['testing/a'],
      )
      test(
        '**/*config*',
        ['config', 'src/myconfig', 'a/b.config.js'],
        ['src/other'],
      )
      test(
        '**/package.json',
        ['package.json', 'src/package.json'],
        ['package.lock'],
      )
      test('**/', ['src/', 'a/b/'], ['src', 'a/b', 'file.js', 'src/file.js'])
      test('**/README.md', ['README.md', 'docs/README.md'], ['readme.md'])
      test(
        '**/node_modules',
        ['node_modules', 'src/node_modules'],
        ['node_module'],
      )
    })

    it('patterns without * or **', () => {
      test('config', ['config'], ['configs', 'src/config', 'myconfig'])
      test('test', ['test'], ['testing', 'src/test', 'mytest'])
      test('src', ['src'], ['source', 'src/file', 'lib/src'])
      test(
        'package.json',
        ['package.json'],
        ['src/package.json', 'package.lock'],
      )
      test('index.js', ['index.js'], ['src/index.js', 'main.js'])
      test('README.md', ['README.md'], ['src/README.md', 'readme.md'])
      test(
        'tsconfig.json',
        ['tsconfig.json'],
        ['src/tsconfig.json', 'config.json'],
      )
      test(
        'node_modules',
        ['node_modules'],
        ['src/node_modules', 'node_module'],
      )
      test(
        'src/config',
        ['src/config'],
        ['config', 'src/configs', 'lib/config'],
      )
      test(
        'test/setup.js',
        ['test/setup.js'],
        ['setup.js', 'src/test/setup.js'],
      )
      test('lib/index.ts', ['lib/index.ts'], ['index.ts', 'src/lib/index.ts'])
      test(
        'docs/api/readme.md',
        ['docs/api/readme.md'],
        ['readme.md', 'docs/readme.md'],
      )
      test('a', ['a'], ['b', 'a/b', ''])
      test('a/b', ['a/b'], ['a', 'a/b/c'])
      test('a/b/c', ['a/b/c'], ['a/b', 'a/b/c/d'])
      test('file.txt', ['file.txt'], ['file.js', 'src/file.txt'])
      test(
        '.gitignore',
        ['.gitignore'],
        ['gitignore', 'src/.gitignore', '.git'],
      )
      test('.env', ['.env'], ['env', 'src/.env', '.env.local'])
    })

    it('mixed * and ** - TONS OF TESTS', () => {
      test('*/**.js', ['a/b.js'], ['a.js', 'a/b', 'x/y/z.js'])
      test('**/*.js', ['a.js', 'x/y.js'], ['a', 'a/b'])
      test('*/**/a', ['x/a', 'x/y/a', '1/2/a'], ['a', 'x/a/b'])
      test(
        '**/*/*.js',
        ['a/b.js', 'x/y/z.js', '1/2/3.js', 'a/b/c/d.js'],
        ['a.js'],
      )
      test(
        '*/**/*.js',
        ['a/b.js', 'a/x/y.js', 'src/lib/file.js'],
        ['a.js', 'b.js'],
      )
      test('**/*/*', ['a/b/c', 'x/y/z', '1/2/3', 'a/b'], ['a'])
      test('*/*/**', ['a/b/c', 'a/b/c/d', 'x/y/z/w'], ['a/b', 'a'])
      test('**/*/a', ['x/y/a', '1/2/a', 'src/lib/a', 'x/a'], ['a'])
      test('*/a/**', ['x/a/b', '1/a/2', 'src/a/lib/file'], ['a/b', 'x/b'])
      test('a/**/*/b', ['a/x/y/b', 'a/1/2/b', 'a/src/lib/b', 'a/x/b'], ['a/b'])
      test('**/a/*/b', ['x/a/y/b', '1/a/2/b', 'src/a/lib/b'], ['a/b', 'x/a/b'])
      test(
        '*/a/b/**',
        ['x/a/b/c', '1/a/b/2', 'src/a/b/file'],
        ['a/b/c', 'x/b/c'],
      )
      test(
        '**/*/b/*',
        ['x/y/b/c', '1/2/b/3', 'src/lib/b/file', 'x/b/c'],
        ['x/y/b'],
      )
      test(
        '**/*/b/*',
        ['x/y/b/c', '1/2/b/3', 'src/lib/b/file', 'x/b/c'],
        ['x/y/b'],
      )
      test('a/**/*/*', ['a/b/c/d', 'a/x/y/z', 'a/1/2/3', 'a/b/c'], ['a/b'])
      test('*/a/**/b', ['x/a/b', 'x/a/y/b', '1/a/2/3/b'], ['a/b', 'x/b'])
      test(
        '**/*/*/*.js',
        ['a/b/c.js', 'x/y/z.js', '1/2/3.js'],
        ['a/b.js', 'a.js'],
      )
      test('*/**/*/a', ['x/y/z/a', '1/2/3/a', 'src/lib/test/a', 'x/y/a'], ['a'])
      test('a/*/b/**', ['a/x/b/c', 'a/1/b/2', 'a/y/b/file'], ['a/b/c', 'a/x/c'])
      test(
        '**/a/*/c',
        ['x/a/b/c', '1/a/2/c', 'src/a/lib/c', 'a/b/c'],
        ['x/a/c'],
      )
      test('*/b/**/c', ['x/b/c', 'x/b/y/c', '1/b/2/3/c'], ['b/c', 'x/c'])
      test(
        'a/**/b/*.js',
        ['a/b/c.js', 'a/x/b/y.js', 'a/1/2/b/3.js'],
        ['a/b.js', 'a/c.js'],
      )
      test(
        '**/a/*/*.js',
        ['src/a/b/lib.js'],
        ['x/a/b.js', '1/a/3/4/5.js', 'a/b.js', 'x/a.js'],
      )
      test(
        '*/a/**/*.js',
        ['x/a/b.js', 'x/a/y/z.js', '1/a/2/3.js'],
        ['a/b.js', 'x/b.js'],
      )
      test('**/*a*/*', ['xa/b', 'x/ya/b', 'x/y/za/b', 'a/b'], ['x/a'])
      test('*/*a*/**', ['x/ya/b', 'x/ya/b/c', '1/2a/3/4', 'x/a/b'], ['ya/b'])
      test(
        '**/*test*/*',
        ['xtest/a', 'x/ytest/a', 'x/y/ztest/a', 'test/a'],
        ['x/test'],
      )
      test(
        '*/*test*/**',
        ['x/ytest/a', 'x/ytest/a/b', '1/2test/3/4', 'x/test/a'],
        ['ytest/a'],
      )
      test(
        '*/src/**/*.js',
        ['a/src/b.js', 'x/src/y/z.js', '1/src/2/3.js'],
        ['src/a.js', 'a/lib/b.js'],
      )
      test(
        '**/src/*/*.js',
        ['x/y/src/a/z.js', '1/src/3/2.js'],
        ['a/src/b.js', 'src/a.js', 'x/src.js'],
      )
      test(
        '*/lib/**/test',
        ['a/lib/test', 'x/lib/y/test', '1/lib/2/3/test'],
        ['lib/test', 'a/test'],
      )
      test(
        '**/lib/*/test',
        ['a/lib/b/test', 'x/y/lib/z/test', '1/lib/2/test', 'lib/a/test'],
        ['x/lib/test'],
      )
      test(
        '*/node_modules/**',
        ['a/node_modules/b', 'x/node_modules/y/z'],
        ['node_modules/a', 'a/lib/b'],
      )
      test(
        '**/node_modules/*',
        ['a/node_modules/b', 'x/y/node_modules/z', 'node_modules/a'],
        ['x/node_modules'],
      )
      test(
        '*/dist/**/*.js',
        ['a/dist/b.js', 'x/dist/y/z.js'],
        ['dist/a.js', 'a/build/b.js'],
      )
      test(
        '**/dist/*.js',
        ['a/dist/b.js', 'x/y/dist/z.js', 'dist/a.js'],
        ['x/dist.js'],
      )
      test(
        '*/build/**/*.json',
        ['a/build/b.json', 'x/build/y/z.json'],
        ['build/a.json', 'a/dist/b.json'],
      )
      test(
        '**/build/*.json',
        ['a/build/b.json', 'x/y/build/z.json', 'build/a.json'],
        ['x/build.json'],
      )
      test(
        '*/public/**/*.css',
        ['a/public/b.css', 'x/public/y/z.css'],
        ['public/a.css', 'a/static/b.css'],
      )
      test(
        '**/public/*.css',
        ['a/public/b.css', 'x/y/public/z.css', 'public/a.css'],
        ['x/public.css'],
      )
      test(
        '*/assets/**/*.png',
        ['a/assets/b.png', 'x/assets/y/z.png'],
        ['assets/a.png', 'a/images/b.png'],
      )
      test(
        '**/assets/*.png',
        ['a/assets/b.png', 'x/y/assets/z.png', 'assets/a.png'],
        ['x/assets.png'],
      )
      test(
        '**/*config*/*',
        ['myconfig/a', 'x/appconfig/b', 'x/y/webpack.config/c', 'config/a'],
        ['x/config'],
      )
      test(
        '*/*config*/**',
        [
          'x/myconfig/a',
          'x/appconfig/a/b',
          '1/webpack.config/c/d',
          'x/config/a',
        ],
        ['myconfig/a'],
      )
      test(
        '*/test/**/*.spec.js',
        ['a/test/b.spec.js', 'x/test/y/z.spec.js'],
        ['test/a.spec.js', 'a/spec/b.js'],
      )
      test(
        '**/test/*.spec.js',
        ['a/test/b.spec.js', 'x/y/test/z.spec.js', 'test/a.spec.js'],
        ['x/test.spec.js'],
      )
      test(
        '*/components/**/*.tsx',
        ['a/components/b.tsx', 'x/components/y/z.tsx'],
        ['components/a.tsx', 'a/src/b.tsx'],
      )
      test(
        '**/components/*.tsx',
        ['a/components/b.tsx', 'x/y/components/z.tsx', 'components/a.tsx'],
        ['x/components.tsx'],
      )
    })

    it('special chars', () => {
      test('a-b', ['a-b'], ['ab', 'a_b', 'a/b'])
      test('a_b', ['a_b'], ['ab', 'a-b', 'a/b'])
      test('a.b', ['a.b'], ['ab', 'a_b', 'a/b'])
      test('a b', ['a b'], ['ab', 'a_b', 'a/b'])
      test('a@b', ['a@b'], ['ab', 'a_b', 'a/b'])
      test('a#b', ['a#b'], ['ab', 'a_b', 'a/b'])
      test('a$b', ['a$b'], ['ab', 'a_b', 'a/b'])
      test('a%b', ['a%b'], ['ab', 'a_b', 'a/b'])
      test('a&b', ['a&b'], ['ab', 'a_b', 'a/b'])
      test('a+b', ['a+b'], ['ab', 'a_b', 'a/b'])
      test('a=b', ['a=b'], ['ab', 'a_b', 'a/b'])
      test('a(b)', ['a(b)', 'ab'], ['a_b', 'a/b'])
      test('a[b]', ['a[b]', 'ab'], ['a_b', 'a/b'])
      test('a{b}', ['a{b}'], ['ab', 'a_b', 'a/b'])
    })

    it('unicode', () => {
      test('файл', ['файл'], ['file', 'src/файл'])
      test('测试', ['测试'], ['test', 'src/测试'])
      test('🎉', ['🎉'], ['test', 'src/🎉'])
      test('café', ['café'], ['cafe', 'src/café'])
      test('naïve', ['naïve'], ['naive', 'src/naïve'])
      test('résumé', ['résumé'], ['resume', 'src/résumé'])
      test('тест', ['тест'], ['test', 'src/тест'])
      test('テスト', ['テスト'], ['test', 'src/テスト'])
      test('한글', ['한글'], ['test', 'src/한글'])
    })

    it('braces', () => {
      test('*.{js,ts}', ['a.js', 'b.ts', 'c.js', 'd.ts'], ['a.txt', 'a.css'])
      test('*.{json,yaml}', ['a.json', 'b.yaml', 'c.json'], ['a.js', 'a.yml'])
      test(
        'test.{spec,test}.js',
        ['test.spec.js', 'test.test.js'],
        ['test.js', 'spec.js'],
      )
      test('{a,b,c}', ['a', 'b', 'c'], ['d', 'ab', 'abc'])
      test(
        '{src,lib}/*.js',
        ['src/a.js', 'lib/b.js'],
        ['test/c.js', 'src/a.ts'],
      )
      test(
        '**/{dist,build}/*.js',
        ['dist/a.js', 'build/b.js', 'x/dist/c.js'],
        ['src/a.js'],
      )
    })

    it('brackets', () => {
      test('[abc]', ['a', 'b', 'c'], ['d', 'ab', 'abc'])
      test('[0-9]', ['0', '5', '9'], ['a', '10', ''])
      test('[a-z]', ['a', 'm', 'z'], ['A', '0', 'aa'])
      test('[A-Z]', ['A', 'M', 'Z'], ['a', '0', 'AA'])
      test(
        'file[0-9].js',
        ['file0.js', 'file5.js', 'file9.js'],
        ['file.js', 'file10.js'],
      )
      test('[!abc]', ['a', 'b', 'c'], ['d', 'e', 'x']) // ! is NOT negation in picomatch
      test('[^abc]', ['d', 'e', 'x'], ['a', 'b', 'c']) // ^ IS negation in picomatch
      test('[a-z][0-9]', ['a1', 'b2', 'z9'], ['aa', '11', 'A1'])
    })

    it('question mark', () => {
      test('?', ['a', '1', 'x'], ['aa', '', 'ab'])
      test('a?', ['ab', 'ax', 'a1'], ['a', 'aaa', 'a/b'])
      test('?a', ['ba', 'xa', '1a', 'aa'], ['a', 'a/b'])
      test('a?c', ['abc', 'axc', 'a1c'], ['ac', 'abbc', 'a/c'])
      test(
        'file?.js',
        ['file1.js', 'filea.js', 'filex.js'],
        ['file.js', 'file10.js'],
      )
      test('??', ['ab', '12', 'xy'], ['a', 'abc'])
      test('???', ['abc', '123', 'xyz'], ['ab', 'abcd'])
      test('test?.ts', ['test1.ts', 'testa.ts'], ['test.ts', 'test10.ts'])
    })

    it('directories', () => {
      test('*/', ['src/', 'test/', 'lib/'], ['src', 'file.js'])
      test('**/', ['src/', 'test/lib/', 'a/b/c/'], ['src', 'file.js'])
      test('src/', ['src/'], ['src', 'lib/'])
      test('test/', ['test/'], ['test', 'src/'])
      test('a/b/', ['a/b/'], ['a/b', 'a/b/c'])
      test(
        '**/test/',
        ['test/', 'src/test/', 'a/b/test/'],
        ['test', 'testing/'],
      )
    })

    it('backslashes', () => {
      test('a\\b', ['a/b', 'a\\b'], ['ab', 'a', 'b'])
      test('src\\*.js', ['src/a.js', 'src/b.js'], ['a.js'])
      test('**\\*.ts', ['a.ts', 'src/b.ts'], ['a.txt'])
      test('a\\b\\c', ['a/b/c', 'a\\b\\c'], ['a/b', 'c'])
      test('**\\test\\*.js', ['test/a.js', 'src/test/b.js'], ['test/a.ts'])
    })

    it('long paths', () => {
      test(
        'a/b/c/d/e/f/g',
        ['a/b/c/d/e/f/g'],
        ['a/b/c/d/e/f', 'a/b/c/d/e/f/g/h'],
      )
      test(
        '*/*/*/*/*/*/*',
        ['a/b/c/d/e/f/g'],
        ['a/b/c/d/e/f', 'a/b/c/d/e/f/g/h'],
      )
      test('**/**/**/**', ['a', 'a/b', 'a/b/c/d/e'], [''])
      test(
        'a/b/c/d/e/f/g/h/i/j',
        ['a/b/c/d/e/f/g/h/i/j'],
        ['a/b/c/d/e/f/g/h/i'],
      )
    })

    it('edge cases', () => {
      test('', [], ['a', 'src/a'])
      test('/', [], ['/', '/a', 'a'])
      test('\\', [], ['\\', '\\a', 'a'])
      test('.', ['.'], ['..', 'a', './a'])
      test('..', ['..'], ['.', '...', '../a'])
      test('...', ['...'], ['..', '....'])
      test('a', ['a'], ['b', 'a/b'])
      test('aa', ['aa'], ['a', 'aaa', 'a/a'])
      test('1', ['1'], ['2', '11', 'a'])
      test('123', ['123'], ['12', '1234'])
    })

    function tc(glob: string, noCase: boolean, yes: string[], no: string[]) {
      const m = createMatchPath({ globs: [glob], noCase })
      yes.forEach(p => expect(m(p)).toBe(true))
      no.forEach(p => expect(m(p)).toBeNull())
    }

    it('case sensitivity', () => {
      tc('Test', false, ['Test'], ['test', 'TEST'])
      tc('Test', true, ['Test', 'test', 'TEST', 'tEsT'], ['Testing'])
      tc('*.JS', false, ['a.JS', 'b.JS'], ['a.js', 'a.Js'])
      tc('*.JS', true, ['a.JS', 'a.js', 'a.Js', 'a.jS'], ['a.ts'])
      tc('**/Config', false, ['Config', 'src/Config'], ['config', 'src/config'])
      tc(
        '**/Config',
        true,
        ['Config', 'config', 'src/Config', 'src/config'],
        ['configuration'],
      )
      tc('README', false, ['README'], ['readme', 'Readme'])
      tc('README', true, ['README', 'readme', 'Readme', 'rEaDmE'], ['READ'])
    })

    function tm(globs: string[], yes: string[], no: string[], nulls: string[]) {
      const m = createMatchPath({ globs })
      yes.forEach(p => expect(m(p)).toBe(true))
      no.forEach(p => expect(m(p)).toBe(false))
      nulls.forEach(p => expect(m(p)).toBe(null))
    }

    it('negation patterns', () => {
      tm(
        ['**/*.js', '!**/*.test.js'],
        ['a.js', 'src/a.js'],
        ['a.test.js', 'src/a.test.js'],
        ['a.ts'],
      )
      tm(
        ['**/*', '!**/node_modules/**'],
        ['src/a.js'],
        ['node_modules/a.js'],
        [],
      )
      tm(
        ['**/*', '!**/*.log'],
        ['a.js', 'src/a.js'],
        ['a.log', 'src/a.log'],
        [],
      )
      tm(['*.js', '!a.js'], ['b.js', 'c.js'], ['a.js'], ['a.ts'])
      tm(
        ['**/*', '!test/**', 'test/keep.js'],
        ['src/a.js', 'test/keep.js'],
        ['test/a.js'],
        [],
      )
    })

    it('exclude patterns', () => {
      tm(['*.js', '^*.test.js'], ['a.js'], ['a.test.js'], ['a.ts'])
      tm(['**/*', '^**/dist/**'], ['src/a.js'], ['dist/a.js'], [])
      tm(
        ['**/*', '^**/node_modules/**', '^!**/node_modules/keep/**'],
        ['src/a.js', 'node_modules/keep/a.js'],
        ['node_modules/a.js'],
        [],
      )
    })

    it('multiple globs', () => {
      tm(['*.js', '*.ts'], ['a.js', 'b.ts'], [], ['a.txt'])
      tm(['src/*', 'lib/*'], ['src/a', 'lib/b'], [], ['test/c'])
      tm(
        ['**/*.js', '**/*.ts', '**/*.json'],
        ['a.js', 'b.ts', 'c.json'],
        [],
        ['d.txt'],
      )
      tm(['**/test/**', '**/spec/**'], ['test/a', 'spec/b'], [], ['src/c'])
    })
  })
})
