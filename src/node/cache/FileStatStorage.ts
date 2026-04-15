import { type IPool, poolRunWait } from '@flemist/time-limits'
import type { CacheStat, IStorageDb } from '../../common'
import path from 'path'
import { poolFs } from '../fs'
import fs from 'fs'
import type { IFileStorage } from './FileStorage'

export type FileStatStorageOptions = {
  storages: {
    value: IFileStorage
    error: IFileStorage
  }
  pool?: null | IPool
}

export class FileStatStorage implements IStorageDb<string, CacheStat> {
  private readonly _options: FileStatStorageOptions
  private readonly _entries: Map<string, CacheStat> = new Map()
  private _entriesLoaded = false

  constructor(options: FileStatStorageOptions) {
    this._options = options
  }

  async set(key: string, value: CacheStat): Promise<void> {
    const storage = value.hasError
      ? this._options.storages.error
      : this._options.storages.value
    const subPath = storage.options.converterSubPath.to(key)
    const filePath = path.resolve(storage.options.dir, subPath)
    await poolRunWait({
      pool: this._options.pool ?? poolFs,
      count: 1,
      func: async () => {
        // utimes requires the target file to exist; Cache writes value/error
        // before calling stat.set, so the parent directory is guaranteed present
        // docs: https://nodejs.org/download/release/v6.14.2/docs/api/fs.html#fs_fs_utimes_path_atime_mtime_callback
        await fs.promises.utimes(
          filePath,
          value.dateUsed / 1000,
          value.dateModified / 1000,
        )
        this._entries.set(key, value)
      },
    })
  }

  async get(key: string): Promise<CacheStat | undefined> {
    const subPath =
      this._options.storages.value.options.converterSubPath.to(key)
    const filePathValue = path.resolve(
      this._options.storages.value.options.dir,
      subPath,
    )
    const filePathError = path.resolve(
      this._options.storages.error.options.dir,
      subPath,
    )
    return await poolRunWait({
      pool: this._options.pool ?? poolFs,
      count: 1,
      func: async () => {
        const [statValue, statError] = await Promise.all([
          fs.promises.stat(filePathValue).catch(err => {
            if (err.code === 'ENOENT') {
              return null
            }
            throw err
          }),
          fs.promises.stat(filePathError).catch(err => {
            if (err.code === 'ENOENT') {
              return null
            }
            throw err
          }),
        ])
        if (statValue != null && statError != null) {
          const hasError = statError.mtimeMs >= statValue.mtimeMs
          const stat = hasError ? statError : statValue
          return {
            dateModified: stat.mtimeMs,
            dateUsed: stat.atimeMs,
            size: stat.size,
            hasError,
          }
        } else if (statValue != null) {
          return {
            dateModified: statValue.mtimeMs,
            dateUsed: statValue.atimeMs,
            size: statValue.size,
            hasError: false,
          }
        } else if (statError != null) {
          return {
            dateModified: statError.mtimeMs,
            dateUsed: statError.atimeMs,
            size: statError.size,
            hasError: true,
          }
        } else {
          return undefined
        }
      },
    })
  }

  async delete(key: string): Promise<void> {
    this._entries.delete(key)
    // Nothing to delete from fs, because stat is stored in file metadata
  }

  async clear(): Promise<void> {
    this._entries.clear()
    // Nothing to clear in fs, because stat is stored in file metadata
  }

  private async _getKeys(): Promise<string[]> {
    const [keysValue, keysError] = await Promise.all([
      this._options.storages.value.getKeys(),
      this._options.storages.error.getKeys(),
    ])
    // Keys from value and error storages cannot intersect by design,
    // otherwise we will have a lot of problems, not just here
    return [...keysValue, ...keysError]
  }

  async getEntries(): Promise<ReadonlyMap<string, CacheStat>> {
    if (!this._entriesLoaded) {
      const keys = await this._getKeys()
      await Promise.all(
        keys.map(async key => {
          if (this._entries.has(key)) {
            return
          }
          const stat = await this.get(key)
          if (stat != null) {
            this._entries.set(key, stat)
          }
        }),
      )
      this._entriesLoaded = true
    }
    return this._entries
  }

  async getKeys(): Promise<string[]> {
    const entries = await this.getEntries()
    return Array.from(entries.keys())
  }
}
