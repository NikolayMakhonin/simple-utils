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
import { type ILockerWithId, LockerWithId, promiseAllWait } from '../async'
import type { NumberRange } from '../types'
import { CacheStats } from './CacheStats'

export type CacheStorages<Key, Value, Error, Stat> = {
  value: IStorage<Key, Value>
  error?: null | IStorage<Key, Error>
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

/** Compare function for LRU eviction strategy */
function compareLru<Key, Stat extends CacheStat>(
  a: [Key, Stat],
  b: [Key, Stat],
): -1 | 0 | 1 {
  if (a[1].dateUsed !== b[1].dateUsed) {
    return a[1].dateUsed < b[1].dateUsed ? -1 : 1
  }
  if (a[1].size !== b[1].size) {
    return a[1].size < b[1].size ? -1 : 1
  }
  if (a[1].dateModified !== b[1].dateModified) {
    return a[1].dateModified < b[1].dateModified ? -1 : 1
  }
  if (a[0] !== b[0]) {
    return a[0] < b[0] ? -1 : 1
  }
  return 0
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
    currentKey: Key,
    sizeOld: number | null | undefined,
    sizeNew: number,
  ): Promise<void> {
    if (this._options.totalSize == null) {
      return
    }

    const totalSizeMin = this._options.totalSize[0]
    const totalSizeMax = this._options.totalSize[1]

    if (sizeNew > totalSizeMax) {
      throw new Error(
        `[Cache][freeUpSpace] value size (${sizeNew}) exceeds maximum total size (${totalSizeMax})`,
      )
    }

    let totalSize = await this._stats.getTotalSize()
    totalSize += sizeNew - (sizeOld ?? 0)

    if (totalSize <= totalSizeMax) {
      return
    }

    const promises: PromiseLike<void>[] = []

    const stats = await this._stats.getEntries()
    const statsArray = Array.from(stats.entries())
    statsArray.sort(compareLru)

    statsArray.forEach(([key, stat]) => {
      // Skip the current key: its space contribution is already accounted for
      if (key === currentKey) {
        return
      }

      // Those that are currently queued are obviously not worth deleting, since they are needed right now
      const hasQueued = this._locker.hasQueued(key)
      if (hasQueued) {
        return
      }

      const totalSizeDelta = -stat.size
      if (
        totalSize > totalSizeMax ||
        totalSize + totalSizeDelta > totalSizeMin
      ) {
        promises.push(
          this._locker.lock(key, async () => {
            await promiseAllWait([
              this._options.storages.value.delete(key),
              this._options.storages.error?.delete(key),
            ])
            return this._stats.set(key, null)
          }),
        )
        totalSize += totalSizeDelta
      }
    })

    await promiseAllWait(promises)
  }

  async getOrCreate<T extends Value>(
    input: Input,
    func: (input: Input) => PromiseLikeOrValue<T>,
  ): Promise<T> {
    const key = this._options.converterInput
      ? await this._options.converterInput(input)
      : (input as unknown as Key)

    return this._locker.lock(key, async () => {
      let statOld = await this._stats.get(key)

      if (
        statOld == null ||
        (this._options.isExpired != null && this._options.isExpired(statOld))
      ) {
        // Expired
        await promiseAllWait([
          this._options.storages.value.delete(key),
          this._options.storages.error?.delete(key),
          this._stats.set(key, null),
        ])
        statOld = null
      } else {
        const [storedValue, storedError] = await Promise.all([
          this._options.storages.value.get(key),
          this._options.storages.error?.get(key),
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
          await this._stats.set(key, statNew)
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
          await this._stats.set(key, statNew)
          throw error
        }
      }

      let value: T = null!
      let funcError: any = null
      let funcThrew = false
      try {
        value = await func(input)
      } catch (error) {
        funcError = error
        funcThrew = true
      }

      if (funcThrew) {
        if (this._options.storages.error == null) {
          await promiseAllWait([
            this._options.storages.value.delete(key),
            this._stats.set(key, null),
          ])
          throw funcError
        }
        const storedError = this._options.converterError
          ? await this._options.converterError.to(funcError)
          : (funcError as unknown as ErrorStored)
        const size =
          this._options.getSize.error(storedError) +
          this._options.getSize.stat()
        await this.freeUpSpace(key, statOld?.size, size)
        await promiseAllWait([
          this._options.storages.error.set(key, storedError),
          this._options.storages.value.delete(key),
        ])
        const now = this._timeController.now()
        const statNew: CacheStat = {
          dateModified: now,
          dateUsed: now,
          size,
          hasError: true,
        }
        await this._stats.set(key, statNew)
        throw funcError
      }

      const storedValue = this._options.converterValue
        ? await this._options.converterValue.to(value)
        : (value as unknown as ValueStored)
      const size =
        this._options.getSize.value(storedValue) + this._options.getSize.stat()
      await this.freeUpSpace(key, statOld?.size, size)
      await promiseAllWait([
        this._options.storages.value.set(key, storedValue),
        this._options.storages.error?.delete(key),
      ])
      const now = this._timeController.now()
      const statNew: CacheStat = {
        dateModified: now,
        dateUsed: now,
        size,
      }
      await this._stats.set(key, statNew)
      return value
    })
  }

  async delete(input: Input): Promise<void> {
    const key = this._options.converterInput
      ? await this._options.converterInput(input)
      : (input as unknown as Key)
    return this._locker.lock(key, async () => {
      await promiseAllWait([
        this._options.storages.value.delete(key),
        this._options.storages.error?.delete(key),
        this._stats.set(key, null),
      ])
    })
  }

  /**
   * Deletes all cache entries at this moment.
   * But does not prevent new entries from being added during the clearing process
   */
  async clear(): Promise<void> {
    const [keysValue, keysError, keysStat] = await Promise.all([
      this._options.storages.value.getKeys(),
      this._options.storages.error?.getKeys(),
      this._options.storages.stat.getKeys(),
    ])
    const keys = new Set([...keysValue, ...(keysError ?? []), ...keysStat])
    const promises: Promise<void>[] = []
    keys.forEach(key => {
      const promiseOrValue = this._locker.lock(key, async () => {
        const innerPromises: PromiseLike<void>[] = []
        const valueDeleteResult = this._options.storages.value.delete(key)
        if (isPromiseLike(valueDeleteResult)) {
          innerPromises.push(valueDeleteResult)
        }
        const errorDeleteResult = this._options.storages.error?.delete(key)
        if (isPromiseLike(errorDeleteResult)) {
          innerPromises.push(errorDeleteResult)
        }
        const statSetResult = this._stats.set(key, null)
        if (isPromiseLike(statSetResult)) {
          innerPromises.push(statSetResult)
        }
        await promiseAllWait(innerPromises)
      })
      if (isPromiseLike(promiseOrValue)) {
        promises.push(promiseOrValue)
      }
    })
    await promiseAllWait(promises)
  }
}
