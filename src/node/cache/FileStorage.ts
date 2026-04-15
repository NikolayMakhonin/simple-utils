import * as path from 'path'
import { type IPool, poolRunWait } from '@flemist/time-limits'
import { poolFs } from 'src/node/fs/pools'
import * as fs from 'fs'
import { type IStorage } from 'src/common/cache/types'
import { writeFileThroughTmp } from './writeFileThroughTmp'
import { generateTempFileName } from './generateTempFileName'
import { type Converter, promiseAllWait } from 'src/common'
import { readDirRecursive } from 'src/node/fs'

export type FileStorageOptionsBase = {
  dir: string
  converterSubPath: Converter<string, string, string, string | null>
}

export type FileStorageOptions = FileStorageOptionsBase & {
  /**
   * Temp dir should be on the same device as dir to be meaningful.
   * The temp dir can be shared between multiple cache instances
   */
  tmpDir: string
  getTempFileName?: null | ((key: string) => string)
  pool?: null | IPool
}

export type IFileStorage = IStorage<string, Uint8Array> & {
  readonly options: FileStorageOptionsBase
}

export class FileStorage implements IFileStorage {
  private readonly _options: FileStorageOptions

  constructor(options: FileStorageOptions) {
    this._options = options
  }

  get options(): FileStorageOptionsBase {
    return this._options
  }

  async set(key: string, value: Uint8Array): Promise<void> {
    const subPath = this._options.converterSubPath.to(key)
    const filePath = path.join(this._options.dir, subPath)
    const tmpFileName = this._options.getTempFileName
      ? this._options.getTempFileName(key)
      : generateTempFileName()
    const tmpPath = path.join(this._options.tmpDir, tmpFileName)
    await writeFileThroughTmp(filePath, tmpPath, value, this._options.pool)
  }

  async get(key: string): Promise<Uint8Array | undefined> {
    const subPath = this._options.converterSubPath.to(key)
    const filePath = path.join(this._options.dir, subPath)
    try {
      const data = await poolRunWait({
        pool: this._options.pool ?? poolFs,
        count: 1,
        func: () => {
          return fs.promises.readFile(filePath)
        },
      })
      return new Uint8Array(data)
    } catch (err) {
      if (err.code === 'ENOENT') {
        return undefined
      }
      throw err
    }
  }

  async delete(key: string): Promise<void> {
    const subPath = this._options.converterSubPath.to(key)
    const filePath = path.join(this._options.dir, subPath)
    try {
      await poolRunWait({
        pool: this._options.pool ?? poolFs,
        count: 1,
        func: () => {
          return fs.promises.unlink(filePath)
        },
      })
    } catch (err) {
      if (err.code === 'ENOENT') {
        return
      }
      throw err
    }
  }

  async clear(): Promise<void> {
    const keys = await this.getKeys()
    await promiseAllWait(keys.map(key => this.delete(key)))
  }

  async getKeys(): Promise<string[]> {
    try {
      const entries = await readDirRecursive(
        this._options.dir,
        this._options.pool,
      )
      const keys: string[] = []
      entries.forEach(([subPath, entity]) => {
        if (!entity.isFile()) {
          return
        }
        const key = this._options.converterSubPath.from(subPath)
        if (key == null) {
          return
        }
        keys.push(key)
      })
      return keys
    } catch (err) {
      if (err.code === 'ENOENT') {
        return []
      }
      throw err
    }
  }
}
