import { type IAbortSignalFast } from '@flemist/abort-controller-fast'
import type { PromiseOrValue } from 'src/common/types/common'
import { isPromiseLike } from 'src/common/async/promise/isPromiseLike'
import { type IPool } from './Pool'
import type { IPriorityQueue } from 'src/common/async/priority-queue'

/** Pool where each hold unit equals multiplier holds in the underlying pool */
export class PoolMult implements IPool {
  private readonly _pool: IPool
  private readonly _multiplier: number

  constructor(pool: IPool, multiplier: number) {
    if (!Number.isInteger(multiplier) || multiplier <= 0) {
      throw new Error(
        `[PoolMult][constructor] multiplier (${multiplier}) should be an integer > 0`,
      )
    }
    this._pool = pool
    this._multiplier = multiplier
  }

  get priorityQueue(): IPriorityQueue {
    return this._pool.priorityQueue
  }

  get heldCountMax(): number {
    return Math.ceil(this._pool.heldCountMax / this._multiplier)
  }

  get heldCount(): number {
    return Math.ceil(this._pool.heldCount / this._multiplier)
  }

  get holdAvailable(): number {
    return Math.floor(this._pool.holdAvailable / this._multiplier)
  }

  get releaseAvailable(): number {
    return Math.floor(this._pool.releaseAvailable / this._multiplier)
  }

  canHold(count: number): boolean {
    return this._pool.canHold(count * this._multiplier)
  }

  hold(count: number): boolean {
    return this._pool.hold(count * this._multiplier)
  }

  release(count: number, dontThrow?: null | boolean): PromiseOrValue<number> {
    const releaseAvailable = this.releaseAvailable
    if (count > releaseAvailable) {
      if (dontThrow) {
        count = releaseAvailable
      } else {
        throw new Error(
          `[PoolMult][release] count (${count}) > releaseAvailable (${releaseAvailable})`,
        )
      }
    }
    if (count === 0) {
      return 0
    }
    const released = this._pool.release(count * this._multiplier)
    if (isPromiseLike(released)) {
      return released.then(() => count)
    }
    return count
  }

  tick(abortSignal?: null | IAbortSignalFast): PromiseOrValue<void> {
    return this._pool.tick(abortSignal)
  }
}
