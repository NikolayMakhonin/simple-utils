import { type IPool } from 'src/common/async/pool/Pool'
import { poolRunWait } from 'src/common/async/pool/poolRunWait'
import type { CacheStat, IStorageDb } from 'src/common'
import { poolFs } from 'src/node/fs'
import * as fs from 'fs'
import { getFileStoragePath, type IFileStorage } from './FileStorage'

export type FileStatStorageOptions = {
  storages: {
    value: IFileStorage
    error?: null | IFileStorage
  }
  pool?: null | IPool
}

/**
 * A storage of cache stats that keeps each stat in the metadata of the file of its key:
 * dateModified is the modification time of the file, dateUsed its access time,
 * and size its size.
 * A stat with hasError is kept by the file of the error storage,
 * any other stat by the file of the value storage.
 * The file must exist before set, because set changes exclusively its times.
 * Delete and clear change no file
 */
export class FileStatStorage implements IStorageDb<string, CacheStat> {
  readonly #options: FileStatStorageOptions
  readonly #entries: Map<string, CacheStat> = new Map()
  #entriesLoaded = false

  constructor(options: FileStatStorageOptions) {
    this.#options = options
  }

  async set(key: string, value: CacheStat): Promise<void> {
    const storage = value.hasError
      ? this.#options.storages.error
      : this.#options.storages.value
    if (storage == null) {
      return
    }
    const filePath = getFileStoragePath(storage.options, key)
    await poolRunWait({
      pool: this.#options.pool ?? poolFs,
      count: 1,
      func: async () => {
        await fs.promises.utimes(
          filePath,
          value.dateUsed / 1000,
          value.dateModified / 1000,
        )
        this.#entries.set(key, value)
      },
    })
  }

  async get(key: string): Promise<CacheStat | undefined> {
    const filePathValue = getFileStoragePath(
      this.#options.storages.value.options,
      key,
    )

    let filePathError: string | null = null
    if (this.#options.storages.error != null) {
      filePathError = getFileStoragePath(
        this.#options.storages.error.options,
        key,
      )
    }

    return await poolRunWait({
      pool: this.#options.pool ?? poolFs,
      count: 1,
      func: async () => {
        const [statValue, statError] = await Promise.all([
          fs.promises.stat(filePathValue).catch(err => {
            if (err.code === 'ENOENT') {
              return null
            }
            throw err
          }),
          filePathError
            ? fs.promises.stat(filePathError).catch(err => {
                if (err.code === 'ENOENT') {
                  return null
                }
                throw err
              })
            : null,
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
    this.#entries.delete(key)
    // Nothing to delete from fs, because stat is stored in file metadata
  }

  async clear(): Promise<void> {
    this.#entries.clear()
    // Nothing to clear in fs, because stat is stored in file metadata
  }

  private async _getKeys(): Promise<string[]> {
    const [keysValue, keysError] = await Promise.all([
      this.#options.storages.value.getKeys(),
      this.#options.storages.error?.getKeys(),
    ])
    // A key is in both storages after a write that stopped between the two files.
    // getEntries() then loads it twice into one entry, from the newer file
    return [...keysValue, ...(keysError ?? [])]
  }

  async getEntries(): Promise<ReadonlyMap<string, CacheStat>> {
    if (!this.#entriesLoaded) {
      const keys = await this._getKeys()
      await Promise.all(
        keys.map(async key => {
          if (this.#entries.has(key)) {
            return
          }
          const stat = await this.get(key)
          if (stat != null) {
            this.#entries.set(key, stat)
          }
        }),
      )
      this.#entriesLoaded = true
    }
    return this.#entries
  }

  async getKeys(): Promise<string[]> {
    const entries = await this.getEntries()
    return Array.from(entries.keys())
  }
}
