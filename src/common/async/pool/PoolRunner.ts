import { type IAbortSignalFast } from '@flemist/abort-controller-fast'
import type { PromiseOrValue } from 'src/common/types/common'
import { type AwaitPriority } from 'src/common/async/priority-queue/helpers'
import { type Priority } from 'src/common/async/priority/Priority'
import { type IPool, poolWait } from './Pool'

/** @deprecated use poolRunWait */
export interface IPoolRunner {
  pool: IPool
  run<T>(
    count: number,
    func: (abortSignal?: null | IAbortSignalFast) => PromiseOrValue<T>,
    priority?: null | Priority,
    abortSignal?: null | IAbortSignalFast,
    awaitPriority?: null | AwaitPriority,
  ): Promise<T>
}

/** @deprecated use poolRunWait */
export class PoolRunner implements IPoolRunner {
  private readonly _pool: IPool

  constructor(pool: IPool) {
    this._pool = pool
  }

  get pool() {
    return this._pool
  }

  async run<T>(
    count: number,
    func: (abortSignal?: null | IAbortSignalFast) => PromiseOrValue<T>,
    priority?: null | Priority,
    abortSignal?: null | IAbortSignalFast,
    awaitPriority?: null | AwaitPriority,
  ): Promise<T> {
    await poolWait({
      pool: this._pool,
      count,
      hold: true,
      priority,
      abortSignal,
      awaitPriority,
    })

    try {
      const result = await func(abortSignal)
      return result
    } finally {
      void this._pool.release(count)
    }
  }
}
