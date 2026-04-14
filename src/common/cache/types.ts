import {
  type PromiseLikeOrValue,
  type PromiseOrValue,
} from '@flemist/async-utils'
import {
  type ConverterAsync,
  converterJson,
  type ConvertToAsync,
} from '../converter'
import { getNormalizedObject } from '../object'
import { sha256 } from '../crypto'
import * as fs from 'fs'
import * as path from 'path'
import { formatAny } from '../string'

export type IStorage<Key, Value> = {
  set(key: Key, value: Value): PromiseLikeOrValue<void>
  get(key: Key): PromiseLikeOrValue<Value | undefined>
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
  converterOutput: ConverterAsync<Value, ValueStored>
  converterError: ConverterAsync<Error, ErrorStored>
  converterStat: ConverterAsync<Stat, ErrorStored>
  storages: CacheStorages<Key, ValueStored, ErrorStored, StatStored>
}

export type ICache<
  Input,
  Value,
  Error,
  Stat,
  Key,
  ValueStored,
  ErrorStored,
  StatStored,
> = {
  getOrCreate: <T extends Value>(
    input: Input,
    func: (input: Input) => PromiseLikeOrValue<T>,
    options?: null | CacheOptions<
      Input,
      Value,
      Error,
      Stat,
      Key,
      ValueStored,
      ErrorStored,
      StatStored
    >,
  ) => PromiseOrValue<T>
}

export type CacheStat = {
  dateCreated: number
  dateUsed: number
}

export function generateTempFileName(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).substring(2)}.tmp`
}

export async function writeFileThroughTmp(
  filePath: string,
  tmpPath: string,
  data: Uint8Array,
): Promise<void> {
  filePath = path.resolve(filePath)
  tmpPath = path.resolve(tmpPath)
  await Promise.all([
    fs.promises.mkdir(path.dirname(filePath), { recursive: true }),
    (async () => {
      await fs.promises.mkdir(path.dirname(tmpPath), { recursive: true })
      await fs.promises.writeFile(tmpPath, data)
    })(),
  ])
  await fs.promises.rename(tmpPath, filePath)
}

export type FileStorageOptions = {
  getFilePath: (key: string) => string
  /** Temp file path should be on the same device as dir to make it sense */
  getTempFilePath: (key: string) => string
}

export class FileStorage implements IStorage<string, Uint8Array> {
  private readonly _options: FileStorageOptions

  constructor(options: FileStorageOptions) {
    this._options = options
  }

  async set(key: string, value: Uint8Array): Promise<void> {
    const filePath = this._options.getFilePath(key)
    const tmpPath = this._options.getTempFilePath(key)
    await writeFileThroughTmp(filePath, tmpPath, value)
  }

  async get(key: string): Promise<Uint8Array | undefined> {
    const filePath = this._options.getFilePath(key)
    try {
      const data = await fs.promises.readFile(filePath)
      return new Uint8Array(data)
    } catch (err) {
      if (err.code === 'ENOENT') {
        return undefined
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
}

export function getJsonKey<T>(obj: T) {
  obj = getNormalizedObject(obj)
  return JSON.stringify(obj ?? null)
}

export function getHashKey(obj?: any): string {
  const json = getJsonKey(obj)
  return sha256(json)
}

export const converterStringToBuffer: ConverterAsync<string, Uint8Array> = {
  to: async (value: string) => {
    return new TextEncoder().encode(value)
  },
  from: async (value: Uint8Array) => {
    return new TextDecoder().decode(value)
  },
}

export const converterJsonBuffer: ConverterAsync<any, Uint8Array> = {
  to: async (value: any) => {
    const json = converterJson.to(value)
    return converterStringToBuffer.to(json)
  },
  from: async (value: Uint8Array) => {
    const json = await converterStringToBuffer.from(value)
    return converterJson.from(json)
  },
}

export const converterErrorToBuffer: ConverterAsync<any, Uint8Array> = {
  to: async (value: any) => {
    const error = formatAny(value, {
      pretty: true,
      maxDepth: 10,
      maxItems: 50,
      maxStringLength: 1000,
    })
    return converterStringToBuffer.to(error)
  },
  from: async (value: Uint8Array) => {
    const errorStr = await converterStringToBuffer.from(value)
    return errorStr
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
  converterOutput?: null | ConverterAsync<Value, Uint8Array>
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
  function getTempFilePath(): string {
    return path.join(options.tmpDir, `${generateTempFileName()}.tmp`)
  }

  return {
    converterInput: options.converterInput ?? getHashKey,
    converterOutput: options.converterOutput ?? converterJsonBuffer,
    converterError: converterErrorToBuffer,
    converterStat: converterJsonBuffer,
    storages: {
      value: new FileStorage({
        getFilePath: (key: string) => path.join(options.dir, `${key}.value`),
        getTempFilePath,
      }),
      error: new FileStorage({
        getFilePath: (key: string) => path.join(options.dir, `${key}.error`),
        getTempFilePath,
      }),
      stat: new FileStorage({
        getFilePath: (key: string) => path.join(options.dir, `${key}.stat`),
        getTempFilePath,
      }),
    },
  }
}

export class Cache<
  Input,
  Value,
  Error,
  Stat,
  Key,
  ValueStored,
  ErrorStored,
  StatStored,
> implements
    ICache<Input, Value, Error, Stat, Key, ValueStored, ErrorStored, StatStored>
{
  private readonly _options: CacheOptions<
    Input,
    Value,
    Error,
    Stat,
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
      Stat,
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
    options?: null | CacheOptions<
      Input,
      Value,
      Error,
      Stat,
      Key,
      ValueStored,
      ErrorStored,
      StatStored
    >,
  ): PromiseOrValue<T> {
    // TODO
  }
}
