import type { CacheStat, ICacheStats, IStorageDb } from './types'
import type { ConverterAsync } from '../converter'
import { PairingHeap, type PairingNode } from '@flemist/pairing-heap'
import { isPromiseLike } from '@flemist/async-utils'
import { pairingHeapForEach } from '../collection/pairingHeapForEach'

export type CacheStatOptions<Key, Stat extends CacheStat, StatStored> = {
  storage: IStorageDb<Key, StatStored>
  converter?: null | ConverterAsync<Stat, StatStored>
}

export class CacheStats<Key, Stat extends CacheStat, StatStored>
  implements ICacheStats<Key, Stat>
{
  private readonly _options: CacheStatOptions<Key, Stat, StatStored>
  private _statsMap: Map<Key, PairingNode<[Key, Stat]>> = null as any
  private _statsHeap: PairingHeap<[Key, Stat]> = null as any
  private _totalSize: number = null as any

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

  private async init(): Promise<void> {
    if (this._statsMap != null) {
      return
    }

    const statsMap = new Map<Key, PairingNode<[Key, Stat]>>()
    const statsHeap = new PairingHeap<[Key, Stat]>({
      lessThanFunc: (a, b) => {
        if (a[1].dateUsed !== b[1].dateUsed) {
          return a[1].dateUsed < b[1].dateUsed
        }
        if (a[1].size !== b[1].size) {
          return a[1].size < b[1].size
        }
        if (a[1].dateModified !== b[1].dateModified) {
          return a[1].dateModified < b[1].dateModified
        }
        return a[0] < b[0]
      },
    })
    let totalSize = 0

    await this.loadStatsMap((key, stat) => {
      const node = statsHeap.add([key, stat])
      statsMap.set(key, node)
      totalSize += stat.size
    })

    this._statsMap = statsMap
    this._statsHeap = statsHeap
    this._totalSize = totalSize
  }

  async getTotalSize(): Promise<number> {
    await this.init()
    return this._totalSize
  }

  async get(key: Key): Promise<Stat | null> {
    await this.init()
    return this._statsMap.get(key)?.item[1] ?? null
  }

  async set(key: Key, statNew: Stat | null | undefined): Promise<void> {
    await this.init()
    if (statNew != null) {
      const storedStat = this._options.converter
        ? await this._options.converter.to(statNew)
        : (statNew as unknown as StatStored)
      await this._options.storage.set(key, storedStat)

      const nodeOld = this._statsMap.get(key)
      const statOld = nodeOld?.item[1]
      if (nodeOld != null) {
        this._statsHeap.delete(nodeOld)
      }
      const nodeNew = this._statsHeap.add([key, statNew])
      this._statsMap.set(key, nodeNew)
      this._totalSize += (statNew?.size ?? 0) - (statOld?.size ?? 0)
    } else {
      await this._options.storage.delete(key)

      const nodeOld = this._statsMap.get(key)
      const statOld = nodeOld?.item[1]
      if (nodeOld != null) {
        this._statsHeap.delete(nodeOld)
        this._statsMap.delete(key)
        this._totalSize -= statOld?.size ?? 0
      }
    }
  }

  forEach(
    func: (key: Key, stat: Stat) => boolean | undefined | null | void,
  ): void {
    const node = this._statsHeap.getMinNode()
    pairingHeapForEach(node, node => func(node.item[0], node.item[1]))
  }
}
