import {
  type PromiseLikeOrValue,
  type PromiseOrValue,
} from '@flemist/async-utils'
import {
  type Converter,
  type ConverterAsync,
  converterJson,
  type ConvertToAsync,
} from '../converter'
import { getNormalizedObject } from '../object'
import { sha256 } from '../crypto'
import * as fs from 'fs'
import * as path from 'path'
import { formatAny } from '../string'
import { poolFs } from '../../node'
import { type IPool, poolRunWait } from '@flemist/time-limits'

export type IStorage<Key, Value> = {
  set(key: Key, value: Value): PromiseLikeOrValue<void>
  get(key: Key): PromiseLikeOrValue<Value | undefined>
  delete(key: Key): PromiseLikeOrValue<void>
  clear(): PromiseLikeOrValue<void>
  getKeys(): PromiseLikeOrValue<Key[]>
}

export type CacheStorages<Key, Value, Error, Stat> = {
  value: IStorage<Key, Value>
  error: IStorage<Key, Error>
  stat: IStorage<Key, Stat>
}

export type CacheOptions<
  Input,
  Value,
  Error,
  Stat,
  Key,
  ValueStored,
  ErrorStored,
  StatStored,
> = {
  converterInput: ConvertToAsync<Input, Key>
  converterValue: ConverterAsync<Value, ValueStored>
  converterError: ConverterAsync<Error, ErrorStored>
  converterStat: ConverterAsync<Stat, StatStored>
  storages: CacheStorages<Key, ValueStored, ErrorStored, StatStored>
  isExpired?: null | ((stat: Stat) => boolean)
}

export type ICache<Input, Value> = {
  getOrCreate: <T extends Value>(
    input: Input,
    func: (input: Input) => PromiseLikeOrValue<T>,
  ) => PromiseOrValue<T>
}

export type CacheStat = {
  dateCreated: number
  dateUsed: number
  hasError?: null | boolean
}

export function generateTempFileName(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).substring(2)}.tmp`
}

export async function writeFileThroughTmp(
  filePath: string,
  tmpPath: string,
  data: Uint8Array,
  pool?: null | IPool,
): Promise<void> {
  filePath = path.resolve(filePath)
  tmpPath = path.resolve(tmpPath)
  await poolRunWait({
    pool: pool ?? poolFs,
    count: 1,
    func: async () => {
      await Promise.all([
        fs.promises.mkdir(path.dirname(filePath), { recursive: true }),
        (async () => {
          await fs.promises.mkdir(path.dirname(tmpPath), { recursive: true })
          await fs.promises.writeFile(tmpPath, data)
        })(),
      ])
      try {
        await fs.promises.rename(tmpPath, filePath)
      } catch (err) {
        await fs.promises.unlink(tmpPath).catch(() => {})
        throw err
      }
    },
  })
}

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

export class MemoryStorage<Key, Value> implements IStorage<Key, Value> {
  private readonly _cache: Map<Key, Value> = new Map()

  set<T extends Value>(key: Key, value: T): PromiseLikeOrValue<void> {
    this._cache.set(key, value)
  }

  get<T extends Value>(key: Key): PromiseLikeOrValue<T | undefined> {
    const value = this._cache.get(key) as T | undefined
    return value
  }

  delete(key: Key): PromiseLikeOrValue<void> {
    this._cache.delete(key)
  }

  clear(): PromiseLikeOrValue<void> {
    this._cache.clear()
  }

  getKeys(): PromiseLikeOrValue<Key[]> {
    return Array.from(this._cache.keys())
  }
}

export function getJsonKey<T>(obj: T) {
  obj = getNormalizedObject(obj)
  return JSON.stringify(obj ?? null)
}

export function getHashKey(obj?: any): string {
  const json = getJsonKey(obj)
  return sha256(json)
}

export const converterStringToBuffer: Converter<string, Uint8Array> = {
  to: (value: string) => {
    return new TextEncoder().encode(value)
  },
  from: (value: Uint8Array) => {
    return new TextDecoder().decode(value)
  },
}

export const converterJsonBuffer: ConverterAsync<any, Uint8Array> = {
  to: (value: any) => {
    const json = converterJson.to(value)
    return converterStringToBuffer.to(json)
  },
  from: (value: Uint8Array) => {
    const json = converterStringToBuffer.from(value)
    return converterJson.from(json)
  },
}

export const converterErrorToBuffer: ConverterAsync<any, Uint8Array> = {
  to: (value: any) => {
    const error = formatAny(value, {
      pretty: true,
      maxDepth: 10,
      maxItems: 50,
      maxStringLength: 1000,
    })
    return converterStringToBuffer.to(error)
  },
  from: (value: Uint8Array) => {
    return converterStringToBuffer.from(value)
  },
}

export function createFileCacheOptions<Input, Value>(options: {
  dir: string
  /**
   * Temp dir should be on the same device as dir to make it sense.
   * The temp dir can be shared between multiple cache instances
   */
  tmpDir: string
  converterInput?: null | ConvertToAsync<Input, string>
  converterValue?: null | ConverterAsync<Value, Uint8Array>
  isExpired?: null | ((stat: CacheStat) => boolean)
}): CacheOptions<
  Input,
  Value,
  any,
  CacheStat,
  string,
  Uint8Array,
  Uint8Array,
  Uint8Array
> {
  return {
    converterInput: options.converterInput ?? getHashKey,
    converterValue: options.converterValue ?? converterJsonBuffer,
    converterError: converterErrorToBuffer,
    converterStat: converterJsonBuffer,
    isExpired: options.isExpired,
    storages: {
      value: new FileStorage({
        dir: options.dir,
        tmpDir: options.tmpDir,
        suffix: '.value',
      }),
      error: new FileStorage({
        dir: options.dir,
        tmpDir: options.tmpDir,
        suffix: '.error',
      }),
      stat: new FileStorage({
        dir: options.dir,
        tmpDir: options.tmpDir,
        suffix: '.stat',
      }),
    },
  }
}

export class Cache<
  Input,
  Value,
  Error,
  Key,
  ValueStored,
  ErrorStored,
  StatStored,
> implements ICache<Input, Value>
{
  private readonly _options: CacheOptions<
    Input,
    Value,
    Error,
    CacheStat,
    Key,
    ValueStored,
    ErrorStored,
    StatStored
  >

  constructor(
    options: CacheOptions<
      Input,
      Value,
      Error,
      CacheStat,
      Key,
      ValueStored,
      ErrorStored,
      StatStored
    >,
  ) {
    this._options = options
  }

  async getOrCreate<T extends Value>(
    input: Input,
    func: (input: Input) => PromiseLikeOrValue<T>,
  ): Promise<T> {
    const key = await this._options.converterInput(input)

    const storedStat = await this._options.storages.stat.get(key)
    let isExpired: boolean
    let stat: CacheStat | null = null
    if (storedStat) {
      stat = await this._options.converterStat.from(storedStat)
      isExpired =
        this._options.isExpired != null ? this._options.isExpired(stat) : false
    } else {
      isExpired = true
    }

    if (isExpired) {
      await Promise.all([
        this._options.storages.value.delete(key),
        this._options.storages.error.delete(key),
        this._options.storages.stat.delete(key),
      ])
    } else {
      const [storedValue, storedError] = await Promise.all([
        this._options.storages.value.get(key),
        this._options.storages.error.get(key),
      ])

      if (storedValue != null) {
        stat = {
          dateCreated: stat?.dateCreated ?? Date.now(),
          dateUsed: Date.now(),
        }
        const [value, storedStat] = await Promise.all([
          this._options.converterValue.from(storedValue),
          this._options.converterStat.to(stat),
        ])
        await this._options.storages.stat.set(key, storedStat)
        return value as T
      }

      if (storedError != null) {
        stat = {
          dateCreated: stat?.dateCreated ?? Date.now(),
          dateUsed: Date.now(),
          hasError: true,
        }
        const [error, storedStat] = await Promise.all([
          this._options.converterError.from(storedError),
          this._options.converterStat.to(stat),
        ])
        await this._options.storages.stat.set(key, storedStat)
        throw error
      }
    }

    try {
      const value = await func(input)
      stat = {
        dateCreated: Date.now(),
        dateUsed: Date.now(),
      }
      const [storedValue, storedStat] = await Promise.all([
        this._options.converterValue.to(value),
        this._options.converterStat.to(stat),
      ])
      await this._options.storages.value.set(key, storedValue)
      await Promise.all([
        this._options.storages.stat.set(key, storedStat),
        this._options.storages.error.delete(key),
      ])
      return value
    } catch (err) {
      stat = {
        dateCreated: Date.now(),
        dateUsed: Date.now(),
        hasError: true,
      }
      const [storedError, storedStat] = await Promise.all([
        this._options.converterError.to(err),
        this._options.converterStat.to(stat),
      ])
      await Promise.all([
        this._options.storages.value.delete(key),
        this._options.storages.error.set(key, storedError),
      ])
      await this._options.storages.stat.set(key, storedStat)
      throw err
    }
  }
}
