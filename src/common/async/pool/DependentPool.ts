import { type IAbortSignalFast } from '@flemist/abort-controller-fast'
import { type IPool } from './Pool'
import { PoolWrapper } from './PoolWrapper'

/**
 * Pool whose availability includes held counts of dependency pools.
 * Holds are placed exclusively on its own pool, so dependency pools remain unblocked.
 *
 * For example, there are 2 pools for loading data,
 * one loads data in the background, and the other for urgent loading on demand.
 * To add a new background task, you need to make sure
 * that the total number of tasks in all pools does not exceed the limit.
 * But if you need to add an urgent task, you need to make sure
 * that only the urgent pool has space.
 * In the worst case, both pools will be busy, but not for long,
 * since background tasks will be completed, and new background tasks
 * will not be added until space is freed up.
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

  tick(abortSignal?: null | IAbortSignalFast): Promise<void> | void {
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
