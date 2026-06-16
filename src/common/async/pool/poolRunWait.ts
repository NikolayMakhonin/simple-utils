import { type IPool, Pool, poolWait } from './Pool'
import { type IAbortSignalFast } from '@flemist/abort-controller-fast'
import { type AwaitPriority } from 'src/common/async/priority-queue/helpers'
import { type Priority } from 'src/common/async/priority/Priority'
import type { PromiseLikeOrValue } from 'src/common/types/common'
import { runWithFinally } from 'src/common/async/runWithFinally'
import { promiseLikeToPromise } from 'src/common/async/promise/promiseLikeToPromise'
import { isPromiseLike } from 'src/common/async/promise/isPromiseLike'

export type PoolRunArgs<T> = {
  pool?: null | IPool
  count: number
  /** holdPool is an independent pool with capacity equal to count, scoped to this call */
  func: (holdPool: IPool | null, abortSignal?: null | IAbortSignalFast) => T
  abortSignal?: null | IAbortSignalFast
}

export type PoolRunWaitArgs<T> = PoolRunArgs<T> & {
  priority?: null | Priority
  awaitPriority?: null | AwaitPriority
}

export function poolRunWait<T>({
  pool,
  count,
  func,
  priority,
  abortSignal,
  awaitPriority,
}: PoolRunWaitArgs<PromiseLikeOrValue<T>>): Promise<T> {
  if (pool == null) {
    const result = promiseLikeToPromise(func(null, abortSignal))
    return isPromiseLike(result) ? result : Promise.resolve(result)
  }
  return promiseLikeToPromise(
    runWithFinally(
      () => {
        return poolWait({
          pool,
          count,
          hold: true,
          priority,
          abortSignal,
          awaitPriority,
        })
      },
      () => {
        const holdPool = new Pool(count)
        return func(holdPool, abortSignal)
      },
      () => {
        return pool.release(count)
      },
    ) as PromiseLike<T>,
  )
}
