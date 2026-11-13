import { describe, it, expect } from 'vitest'
import { walkPaths } from './walkPaths'
import * as path from 'path'
import { pathResolve } from './helpers'
import { createMatchPath } from 'src/node/fs/glob/createMatchPath'

describe.skip('walkPaths', () => {
  it('pathResolve', async () => {
    expect(pathResolve('D:/')).toBe('D:\\')
    expect(pathResolve('D:')).toBe('D:\\')
    expect(path.join('D:', 'test')).toBe('D:\\test')
    expect(path.resolve('E:/')).toBe('E:\\')
    expect(path.resolve('C:/')).toBe('C:\\')
    expect(path.resolve('E:')).toBe('E:\\')
    expect(path.resolve('C:')).toBe('C:\\')
    expect(path.resolve('D:')).toBe(path.resolve('.'))
  })

  it(
    'base',
    async () => {
      const timeStart = performance.now()

      const result = await walkPaths({
        paths: ['C:', 'D:', 'E:'],
        matchPath: createMatchPath({
          globs: [
            '*',
            '*/*',
            '!**/node_modules',
            '!**/{dist,build}',
            '**/build',
          ],
        }),
        log: {
          maxNestedLevel: 20,
          minTotalContentSize: 0,
        },
        walkLinks: true,
        handlePath: args => {
          console.log(args.path)
          return true
        },
        handleError: err => {
          // Error: EPERM: operation not permitted, scandir 'C:\Users\Mika\Application Data'
          console.log(`Error: ${err.code}: ${err.path}`)
          return true
        },
      })

      console.log(`Total size: ${JSON.stringify(result, null, 2)}`)
      console.log(`Time: ${performance.now() - timeStart} ms`)
    },
    24 * 60 * 60 * 1000,
  )
})
