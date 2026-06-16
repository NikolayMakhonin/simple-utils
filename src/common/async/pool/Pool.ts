import { type IAbortSignalFast } from '@flemist/abort-controller-fast'
import { ManualPromise } from 'src/common/async/promise/ManualPromise'
import { promiseToAbortable } from 'src/common/async/abort/promiseToAbortable'
import {
  type AwaitPriority,
  awaitPriorityDefault,
  getPriorityQueueGlobal,
} from 'src/common/async/priority-queue/helpers'
import { type Priority } from 'src/common/async/priority/Priority'

/**
 * Counting semaphore for limiting concurrent access to a shared resource.
 * Hold of any count always succeeds on an empty pool;
 * heldCountMax restricts hold exclusively when the pool is non-empty
 */
export interface IPool {
  readonly heldCountMax: number
  readonly heldCount: number
  readonly holdAvailable: number
  readonly releaseAvailable: number

  canHold(count: number): boolean
  hold(count: number): boolean
  release(count: number, dontThrow?: null | boolean): Promise<number> | number

  tick(abortSignal?: null | IAbortSignalFast): Promise<void> | void
}

export class Pool implements IPool {
  private readonly _heldCountMax: number = 0
  private _heldCount: number = 0
  private _tickPromise: ManualPromise | null = null

  constructor(heldCountMax: number) {
    if (!Number.isInteger(heldCountMax) || heldCountMax < 0) {
      throw new Error(
        `[Pool][constructor] heldCountMax (${heldCountMax}) should be an integer >= 0`,
      )
    }
    this._heldCountMax = heldCountMax
  }

  get heldCountMax() {
    return this._heldCountMax
  }

  get heldCount() {
    return this._heldCount
  }

  get holdAvailable() {
    return Math.max(0, this._heldCountMax - this._heldCount)
  }

  get releaseAvailable() {
    return this._heldCount
  }

  canHold(count: number): boolean {
    return this.heldCount === 0 || count <= this.holdAvailable
  }

  hold(count: number): boolean {
    const heldCount = this._heldCount
    if (heldCount !== 0 && count > this.holdAvailable) {
      return false
    }
    this._heldCount = heldCount + count
    return true
  }

  release(count: number, dontThrow?: null | boolean): number {
    const releaseAvailable = this.releaseAvailable
    if (count > releaseAvailable) {
      if (dontThrow) {
        count = releaseAvailable
      } else {
        throw new Error(
          `[Pool][release] count (${count}) > releaseAvailable (${releaseAvailable})`,
        )
      }
    }
    if (count > 0) {
      this._heldCount -= count

      if (this._tickPromise) {
        const tickPromise = this._tickPromise
        this._tickPromise = null
        tickPromise.resolve()
      }
    }
    return count
  }

  tick(abortSignal?: null | IAbortSignalFast): Promise<void> | void {
    if (this._heldCount === 0) {
      return
    }
    if (!this._tickPromise) {
      this._tickPromise = new ManualPromise()
    }
    return promiseToAbortable(abortSignal, this._tickPromise.promise)
  }
}

/** Waits until the pool can hold the requested count, optionally holding it */
export function poolWait({
  pool,
  count,
  hold,
  priority,
  abortSignal,
  awaitPriority,
}: {
  pool: IPool
  count: number
  hold?: null | boolean | number
  priority?: null | Priority
  abortSignal?: null | IAbortSignalFast
  awaitPriority?: null | AwaitPriority
}): Promise<void> {
  if (!awaitPriority) {
    awaitPriority = awaitPriorityDefault
  }

  return getPriorityQueueGlobal().run(
    async abortSignal => {
      while (!pool.canHold(count)) {
        await pool.tick(abortSignal)
        await awaitPriority(priority, abortSignal)
      }
      if (hold != null && hold !== false) {
        const holdCount = typeof hold === 'number' ? hold : count
        if (!pool.hold(holdCount)) {
          throw new Error('[poolWait] hold failed after canHold succeeded')
        }
      }
    },
    priority,
    abortSignal,
  )
}
