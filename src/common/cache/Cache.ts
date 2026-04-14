import type { PromiseLikeOrValue } from '@flemist/async-utils'
import type { ICache, IStorage } from './types'
import type { ConverterAsync, ConvertToAsync } from 'src/common/converter'

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

export type CacheStat = {
  dateCreated: number
  dateUsed: number
  hasError?: null | boolean
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
