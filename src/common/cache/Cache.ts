import { isPromiseLike, type PromiseLikeOrValue } from '@flemist/async-utils'
import type {
  CacheStat,
  ICache,
  ICacheStats,
  IStorage,
  IStorageDb,
} from './types'
import type { ConverterAsync, ConvertToAsync } from 'src/common/converter'
import {
  type ITimeController,
  timeControllerDefault,
} from '@flemist/time-controller'
import { type ILockerWithId, LockerWithId } from '../async'
import type { NumberRange } from '../types'
import { CacheStats } from './CacheStats'

export type CacheStorages<Key, Value, Error, Stat> = {
  value: IStorage<Key, Value>
  error: IStorage<Key, Error>
  stat: IStorageDb<Key, Stat>
}

export type CacheOptions<
  Input,
  Value,
  Error,
  Stat extends CacheStat,
  Key = Input,
  ValueStored = Value,
  ErrorStored = Error,
  StatStored = Stat,
> = {
  converterInput?: null | ConvertToAsync<Input, Key>
  converterValue?: null | ConverterAsync<Value, ValueStored>
  converterError?: null | ConverterAsync<Error, ErrorStored>
  converterStat?: null | ConverterAsync<Stat, StatStored>
  storages: CacheStorages<Key, ValueStored, ErrorStored, StatStored>
  /**
   * 1) When adding a new value to the cache, the cache size should not exceed totalSize[1]
   * 2) After freeing up space, the cache size should not become less than totalSize[0]
   * If both conditions cannot be met at the same time, priority is given to the first condition
   * If it is not possible to meet even the first condition, an error is thrown
   */
  totalSize?: null | NumberRange
  getSize: {
    value: (value: ValueStored) => number
    error: (error: ErrorStored) => number
    stat: () => number
  }
  isExpired?: null | ((stat: Stat) => boolean)
  timeController?: null | ITimeController
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
  private readonly _timeController: ITimeController
  private readonly _locker: ILockerWithId<Key>
  private readonly _stats: ICacheStats<Key, CacheStat>

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
    this._timeController = options.timeController ?? timeControllerDefault
    this._locker = new LockerWithId()
    this._stats = new CacheStats({
      storage: options.storages.stat,
      converter: options.converterStat,
    })
  }

  private async freeUpSpace(
    statOld: CacheStat | null,
    statNew: CacheStat,
  ): Promise<void> {
    if (this._options.totalSize == null) {
      return
    }

    const totalSizeMin = this._options.totalSize[0]
    const totalSizeMax = this._options.totalSize[1]

    if (statNew.size > totalSizeMax) {
      throw new Error(
        `[Cache] Cannot add value to cache because its size (${statNew.size}) exceeds the maximum total size (${totalSizeMax})`,
      )
    }

    let totalSizeOld = await this._stats.getTotalSize()
    const totalSizeDelta = statNew.size - (statOld?.size ?? 0)

    if (totalSizeOld + totalSizeDelta <= totalSizeMax) {
      return
    }

    totalSizeOld += totalSizeDelta

    const promises: PromiseLike<void>[] = []
    this._stats.forEach((key, stat) => {
      const totalSizeDelta = -stat.size
      if (
        totalSizeOld > totalSizeMax ||
        totalSizeOld + totalSizeDelta > totalSizeMin
      ) {
        promises.push(
          Promise.all([
            this._options.storages.value.delete(key),
            this._options.storages.error.delete(key),
          ]).then(() => {
            return this._stats.set(key, stat, null)
          }),
        )
        totalSizeOld += totalSizeDelta
      } else {
        return true
      }
    })

    await Promise.all(promises)
  }

  async getOrCreate<T extends Value>(
    input: Input,
    func: (input: Input) => PromiseLikeOrValue<T>,
  ): Promise<T> {
    const key = this._options.converterInput
      ? await this._options.converterInput(input)
      : (input as unknown as Key)

    return this._locker.lock(key, async () => {
      const statOld = await this._stats.get(key)

      if (
        statOld == null ||
        (this._options.isExpired != null && this._options.isExpired(statOld))
      ) {
        // Expired
        await Promise.all([
          this._options.storages.value.delete(key),
          this._options.storages.error.delete(key),
          this._stats.set(key, statOld, null),
        ])
      } else {
        const [storedValue, storedError] = await Promise.all([
          this._options.storages.value.get(key),
          this._options.storages.error.get(key),
        ])

        const now = this._timeController.now()

        if (!statOld.hasError && storedValue != null) {
          const statNew = {
            ...statOld,
            dateUsed: now,
          }
          const value = this._options.converterValue
            ? await this._options.converterValue.from(storedValue)
            : (storedValue as unknown as Value)
          await this._stats.set(key, statOld, statNew)
          return value as T
        }

        if (statOld.hasError && storedError != null) {
          const statNew = {
            ...statOld,
            dateUsed: now,
          }
          const error = this._options.converterError
            ? await this._options.converterError.from(storedError)
            : (storedError as unknown as Error)
          await this._stats.set(key, statOld, statNew)
          throw error
        }
      }

      try {
        const value = await func(input)
        const now = this._timeController.now()
        const storedValue = this._options.converterValue
          ? await this._options.converterValue.to(value)
          : (value as unknown as ValueStored)
        const size =
          this._options.getSize.value(storedValue) +
          this._options.getSize.stat()
        const statNew: CacheStat = {
          dateModified: now,
          dateUsed: now,
          size,
        }
        await this.freeUpSpace(statOld, statNew)
        await Promise.all([
          this._options.storages.value.set(key, storedValue),
          this._options.storages.error.delete(key),
        ])
        await this._stats.set(key, statOld, statNew)
        return value
      } catch (error) {
        const now = this._timeController.now()
        const storedError = this._options.converterError
          ? await this._options.converterError.to(error)
          : (error as unknown as ErrorStored)
        const size =
          this._options.getSize.error(storedError) +
          this._options.getSize.stat()
        const statNew: CacheStat = {
          dateModified: now,
          dateUsed: now,
          size,
          hasError: true,
        }
        await this.freeUpSpace(statOld, statNew)
        await Promise.all([
          this._options.storages.error.set(key, storedError),
          this._options.storages.value.delete(key),
        ])
        await this._stats.set(key, statOld, statNew)
        throw error
      }
    })
  }

  async delete(input: Input): Promise<void> {
    const key = this._options.converterInput
      ? await this._options.converterInput(input)
      : (input as unknown as Key)
    return this._locker.lock(key, async () => {
      await Promise.all([
        this._options.storages.value.delete(key),
        this._options.storages.error.delete(key),
        this._options.storages.stat.delete(key),
      ])
    })
  }

  async clear(): Promise<void> {
    const [keysValue, keysError, keysStat] = await Promise.all([
      this._options.storages.value.getKeys(),
      this._options.storages.error.getKeys(),
      this._options.storages.stat.getKeys(),
    ])
    const keys = new Set([...keysValue, ...keysError, ...keysStat])
    const promises: Promise<void>[] = []
    keys.forEach(key => {
      const promiseOrValue = this._locker.lock(key, async () => {
        const promises: PromiseLike<void>[] = []
        let promiseOrValue: PromiseLikeOrValue<void>
        promiseOrValue = this._options.storages.value.delete(key)
        if (isPromiseLike(promiseOrValue)) {
          promises.push(promiseOrValue)
        }
        promiseOrValue = this._options.storages.error.delete(key)
        if (isPromiseLike(promiseOrValue)) {
          promises.push(promiseOrValue)
        }
        promiseOrValue = this._options.storages.stat.delete(key)
        if (isPromiseLike(promiseOrValue)) {
          promises.push(promiseOrValue)
        }
        await Promise.all(promises)
      })
      if (isPromiseLike(promiseOrValue)) {
        promises.push(promiseOrValue)
      }
    })
    await Promise.all(promises)
  }
}
