import * as fs from 'fs'
import * as path from 'path'
import { globToRelative } from './globToRelative'
import { poolRunWait } from '@flemist/time-limits'
import { globGitIgnoreToPicomatch } from './globGitIgnoreToPicomatch'
import { poolFs } from 'src/node/fs/pools'

/**
 * @import {CreateMatchPathOptions} from "./walkPaths/createMatchPath"
 */

// TODO: write doc comments
// see CreateMatchPathOptions['globs'] for glob syntax
export type Glob = {
  value: string
  valueType: 'file-contains-patterns' | 'pattern'
  /**
   * exclude like .gitignore by adding ^ prefix to glob.
   * @see CreateMatchPathOptions
   */
  exclude: boolean
}
// TODO: write doc comments
export type LoadGlobsOptions = {
  /** default: cwd */
  rootDir?: string | null
  globs?: Glob[] | null
}

// TODO: write doc comments
function globExclude(glob: string): string {
  return '^' + glob
}

// TODO: write doc comments
export async function loadGlobsFromFile(filePath: string): Promise<string[]> {
  const content = await fs.promises.readFile(filePath, 'utf-8')
  const lines = content.split('\n')
  const globs: string[] = []
  lines.forEach(line => {
    line = line.trim()
    if (!line || line.startsWith('#')) {
      return
    }
    globs.push(line)
  })
  return globs
}

// TODO: write doc comments
export async function loadGlobs(options: LoadGlobsOptions): Promise<string[]> {
  const rootDir = options.rootDir ?? '.'
  const result: string[] = []
  if (!options.globs?.length) {
    return result
  }
  const filesContainsGlobs: Glob[] = []
  options.globs.forEach(glob => {
    if (!glob.value) {
      return
    }
    if (glob.valueType === 'file-contains-patterns') {
      filesContainsGlobs.push(glob)
    } else if (glob.valueType === 'pattern') {
      result.push(glob.exclude ? globExclude(glob.value) : glob.value)
    }
  })
  if (filesContainsGlobs.length) {
    await Promise.all(
      filesContainsGlobs.map(async glob => {
        await poolRunWait({
          pool: poolFs,
          count: 1,
          func: async () => {
            const filePath = path.resolve(rootDir, glob.value)
            const globs = await loadGlobsFromFile(filePath)
            const relativePath = path.relative(rootDir, path.dirname(filePath))
            globs.forEach(globValue => {
              globValue = globGitIgnoreToPicomatch(globValue)
              globValue = globToRelative(globValue, relativePath)
              result.push(glob.exclude ? globExclude(globValue) : globValue)
            })
          },
        })
      }),
    )
  }
  return result
}
