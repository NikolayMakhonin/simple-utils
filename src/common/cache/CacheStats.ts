import type { CacheStat, ICacheStats, IStorageDb } from './types'
import type { ConverterAsync } from '../converter'
import { isPromiseLike } from '@flemist/async-utils'

export type CacheStatOptions<Key, Stat extends CacheStat, StatStored> = {
  storage: IStorageDb<Key, StatStored>
  converter?: null | ConverterAsync<Stat, StatStored>
}

export class CacheStats<Key, Stat extends CacheStat, StatStored>
  implements ICacheStats<Key, Stat>
{
  private readonly _options: CacheStatOptions<Key, Stat, StatStored>
  private _statsMap: Map<Key, Stat> = null!
  private _totalSize: number = null!
  private _initPromise: Promise<void> | null = null

  constructor(options: CacheStatOptions<Key, Stat, StatStored>) {
    this._options = options
  }

  private async loadStatsMap(
    addItem: (key: Key, stat: Stat) => void,
  ): Promise<void> {
    const entries = await this._options.storage.getEntries()

    const promises: PromiseLike<void>[] = []
    entries.forEach((statStored, key) => {
      const promiseOrValue = this._options.converter
        ? this._options.converter.from(statStored)
        : (statStored as unknown as Stat)
      if (isPromiseLike(promiseOrValue)) {
        promises.push(
          promiseOrValue.then(stat => {
            addItem(key, stat)
          }),
        )
      } else {
        addItem(key, promiseOrValue)
      }
    })

    await Promise.all(promises)
  }

  private init(): Promise<void> {
    if (this._initPromise == null) {
      this._initPromise = this._init()
    }
    return this._initPromise
  }

  private async _init(): Promise<void> {
    const statsMap = new Map<Key, Stat>()
    let totalSize = 0

    await this.loadStatsMap((key, stat) => {
      statsMap.set(key, stat)
      totalSize += stat.size
    })

    this._statsMap = statsMap
    this._totalSize = totalSize
  }

  async getTotalSize(): Promise<number> {
    await this.init()
    return this._totalSize
  }

  async get(key: Key): Promise<Stat | null> {
    await this.init()
    return this._statsMap.get(key) ?? null
  }

  async set(key: Key, statNew: Stat | null | undefined): Promise<void> {
    await this.init()
    if (statNew != null) {
      const storedStat = this._options.converter
        ? await this._options.converter.to(statNew)
        : (statNew as unknown as StatStored)
      await this._options.storage.set(key, storedStat)

      const statOld = this._statsMap.get(key)
      this._statsMap.set(key, statNew)
      this._totalSize += statNew.size - (statOld?.size ?? 0)
    } else {
      await this._options.storage.delete(key)

      const statOld = this._statsMap.get(key)
      if (statOld != null) {
        this._statsMap.delete(key)
        this._totalSize -= statOld.size
      }
    }
  }

  async getEntries(): Promise<ReadonlyMap<Key, Stat>> {
    await this.init()
    return this._statsMap
  }
}
