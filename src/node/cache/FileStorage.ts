import path from 'path'
import { type IPool, poolRunWait } from '@flemist/time-limits'
import { poolFs } from 'src/node/fs/pools'
import fs from 'fs'
import { type IStorage } from 'src/common/cache/types'
import { writeFileThroughTmp } from './writeFileThroughTmp'
import { generateTempFileName } from './generateTempFileName'

export type FileStorageOptions = {
  dir: string
  /**
   * Temp dir should be on the same device as dir to make it sense.
   * The temp dir can be shared between multiple cache instances
   */
  tmpDir: string
  prefix?: null | string
  suffix?: null | string
  getTempFileName?: null | ((key: string) => string)
  pool?: null | IPool
}

export class FileStorage implements IStorage<string, Uint8Array> {
  private readonly _options: FileStorageOptions

  constructor(options: FileStorageOptions) {
    this._options = options
  }

  async set(key: string, value: Uint8Array): Promise<void> {
    const fileName =
      (this._options.prefix ?? '') + key + (this._options.suffix ?? '')
    const filePath = path.join(this._options.dir, fileName)
    const tmpFileName = this._options.getTempFileName
      ? this._options.getTempFileName(key)
      : generateTempFileName()
    const tmpPath = path.join(this._options.tmpDir, tmpFileName)
    await writeFileThroughTmp(filePath, tmpPath, value, this._options.pool)
  }

  async get(key: string): Promise<Uint8Array | undefined> {
    const fileName =
      (this._options.prefix ?? '') + key + (this._options.suffix ?? '')
    const filePath = path.join(this._options.dir, fileName)
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
    const fileName =
      (this._options.prefix ?? '') + key + (this._options.suffix ?? '')
    const filePath = path.join(this._options.dir, fileName)
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
    await Promise.all(keys.map(key => this.delete(key)))
  }

  async getKeys(): Promise<string[]> {
    try {
      const files = await poolRunWait({
        pool: this._options.pool ?? poolFs,
        count: 1,
        func: () => {
          return fs.promises.readdir(this._options.dir, {
            withFileTypes: true,
          })
        },
      })
      const keys: string[] = []
      files.forEach(file => {
        if (!file.isFile()) {
          return
        }
        const fileName = file.name
        if (
          this._options.prefix &&
          !fileName.startsWith(this._options.prefix)
        ) {
          return
        }
        if (this._options.suffix && !fileName.endsWith(this._options.suffix)) {
          return
        }
        const key = fileName.substring(
          this._options.prefix?.length ?? 0,
          fileName.length - (this._options.suffix?.length ?? 0),
        )
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
