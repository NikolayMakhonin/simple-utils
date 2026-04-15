import { type IPool, poolRunWait } from '@flemist/time-limits'
import * as fs from 'fs'
import { type Dirent } from 'fs'
import * as path from 'path'
import { poolFs } from './pools'
import { pathNormalize } from './pathNormalize'

function readDir(dir: string, pool?: null | IPool): Promise<Dirent[]> {
  return poolRunWait({
    pool: pool ?? poolFs,
    count: 1,
    func: () => {
      return fs.promises.readdir(dir, { withFileTypes: true })
    },
  })
}

/**
 * @return [normalized subPath, Dirent][]
 */
export async function readDirRecursive(
  dir: string,
  pool?: null | IPool,
): Promise<[string, Dirent][]> {
  const result: [string, Dirent][] = []
  async function readDirRecursiveInner(
    dir: string,
    subPath: string,
  ): Promise<void> {
    let entries: Dirent[]
    try {
      entries = await readDir(dir, pool)
    } catch (err) {
      // tolerate concurrent removal of nested subdirectories;
      // top-level ENOENT is handled by the caller
      if (subPath !== '' && err.code === 'ENOENT') {
        return
      }
      throw err
    }
    let promises: Promise<void>[] | null = null
    entries.forEach(entry => {
      const entrySubpath = path.join(subPath, entry.name)
      result.push([pathNormalize(entrySubpath), entry])
      if (entry.isDirectory()) {
        if (promises == null) {
          promises = []
        }
        promises.push(
          readDirRecursiveInner(path.join(dir, entry.name), entrySubpath),
        )
      }
    })
    if (promises != null) {
      await Promise.all(promises)
    }
  }
  await readDirRecursiveInner(dir, '')
  return result
}
