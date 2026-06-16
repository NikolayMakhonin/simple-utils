import { type IAbortSignalFast } from '@flemist/abort-controller-fast'
import type { PromiseOrValue } from 'src/common/types/common'
import { WeakOrMapFull } from 'src/common/object/weak-or/WeakOrMapFull'
import { type IPool, Pool } from './Pool'
import { PoolMult } from './PoolMult'
import { Pools } from './Pools'

/**
 * Map of pools where each key has its own pool.
 * Inherited IPool methods operate in bulk: hold(1) holds all keys at once
 */
export interface IPoolMap<Key> extends IPool {
  get(key: Key): IPool
}

export type PoolMapOptions<Key> = {
  /** Shared pool for all keys, used for hold/release all keys at once, and limit total hold count across all keys */
  commonPool: IPool
  createKeyPool?: null | ((key: Key) => IPool)
}

/** Each get(key) pool is limited by both its own key pool and the commonPool */
export class PoolMap<Key> implements IPoolMap<Key> {
  private readonly _commonPool: IPool
  private readonly _bulkPool: IPool
  private readonly _createKeyPool: (key: Key) => IPool
  private readonly _keyPools: WeakOrMapFull<Key, IPool> = new WeakOrMapFull()

  constructor(options: PoolMapOptions<Key>) {
    this._commonPool = options.commonPool
    this._bulkPool =
      this._commonPool.heldCountMax > 0
        ? new PoolMult(this._commonPool, this._commonPool.heldCountMax)
        : this._commonPool
    this._createKeyPool = options.createKeyPool ?? createKeyPoolDefault
  }

  get(key: Key): IPool {
    let pool = this._keyPools.get(key)
    if (pool == null) {
      pool = new Pools(this._commonPool, this._createKeyPool(key))
      this._keyPools.set(key, pool)
    }
    return pool
  }

  get heldCountMax(): number {
    return this._bulkPool.heldCountMax
  }

  get heldCount(): number {
    return this._bulkPool.heldCount
  }

  get holdAvailable(): number {
    return this._bulkPool.holdAvailable
  }

  get releaseAvailable(): number {
    return this._bulkPool.releaseAvailable
  }

  canHold(count: number): boolean {
    return this._bulkPool.canHold(count)
  }

  hold(count: number): boolean {
    return this._bulkPool.hold(count)
  }

  release(count: number, dontThrow?: null | boolean): PromiseOrValue<number> {
    return this._bulkPool.release(count, dontThrow)
  }

  tick(abortSignal?: null | IAbortSignalFast): PromiseOrValue<void> {
    return this._bulkPool.tick(abortSignal)
  }
}

function createKeyPoolDefault(): IPool {
  return new Pool(1)
}
