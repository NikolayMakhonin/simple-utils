import { type IAbortSignalFast } from '@flemist/abort-controller-fast'
import type { PromiseOrValue } from 'src/common/types/common'
import { type IPool } from './Pool'
import { PoolWrapper } from './PoolWrapper'

/**
 * Pool where heldCount is the sum of own pool and all dependency pools,
 * but hold/release operate exclusively on own pool.
 * This allows a low-priority pool to yield capacity to high-priority pools
 * without blocking them
 */
export class DependentPool extends PoolWrapper {
  private readonly _pools: IPool[]

  constructor(pool: IPool, ...dependencies: IPool[]) {
    super(pool)
    this._pools = dependencies
  }

  get heldCount() {
    let heldCount: number = this._pool.heldCount
    const pools = this._pools
    for (let i = 0, len = pools.length; i < len; i++) {
      heldCount += pools[i].heldCount
    }
    return heldCount
  }

  get holdAvailable() {
    return Math.max(0, this.heldCountMax - this.heldCount)
  }

  canHold(count: number): boolean {
    return this.heldCount === 0 || count <= this.holdAvailable
  }

  hold(count: number): boolean {
    if (!this.canHold(count)) {
      return false
    }
    return this._pool.hold(count)
  }

  tick(abortSignal?: null | IAbortSignalFast): PromiseOrValue<void> {
    let promises: Promise<void>[] | null = null
    const promise = this._pool.tick(abortSignal)
    if (promise) {
      promises = [promise]
    }
    for (let i = 0, len = this._pools.length; i < len; i++) {
      const promise = this._pools[i].tick(abortSignal)
      if (promise) {
        if (!promises) {
          promises = [promise]
        } else {
          promises.push(promise)
        }
      }
    }

    if (!promises) {
      return
    }

    return Promise.race(promises)
  }
}
