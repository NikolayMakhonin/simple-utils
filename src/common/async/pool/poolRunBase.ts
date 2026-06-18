import { type IPool, Pool } from './Pool'
import type { IAbortSignalFast } from '@flemist/abort-controller-fast'
import type {
  PromiseLikeOrValue,
  PromiseOrValue,
} from 'src/common/types/common'
import { runWithFinally } from 'src/common/async/runWithFinally'
import { promiseLikeToPromise } from 'src/common/async/promise/promiseLikeToPromise'

export type PoolRunFuncArgs = {
  holdPool: IPool | null
  abortSignal: IAbortSignalFast | null
  release: IPool['release'] | null
}

export type PoolRunArgs<T> = {
  pool?: null | IPool
  count: number
  /** holdPool is an independent pool with capacity equal to count, scoped to this call */
  func: (args: PoolRunFuncArgs) => T
  abortSignal?: null | IAbortSignalFast
}

export type PoolRunBaseArgs<
  FuncResult,
  InitResult extends PromiseLikeOrValue<number>,
> = {
  pool?: null | IPool
  func: (args: PoolRunFuncArgs) => FuncResult
  abortSignal?: null | IAbortSignalFast
  /** Acquires pool slots; returns the held count used for holdPool capacity and release tracking */
  init: () => InitResult
}

export function poolRunBase<Result>({
  pool,
  func,
  abortSignal,
  init,
}: PoolRunBaseArgs<
  PromiseLikeOrValue<Result>,
  PromiseLikeOrValue<number>
>): PromiseOrValue<Result> {
  if (pool == null) {
    return promiseLikeToPromise(
      func({
        holdPool: null,
        abortSignal: abortSignal ?? null,
        release: null,
      }),
    )
  }

  let releasePool: Pool | null = null
  const release: IPool['release'] = (releaseCount, dontThrow) => {
    const releasedCount = releasePool!.release(releaseCount, dontThrow)
    return pool.release(releasedCount, dontThrow)
  }

  return runWithFinally(
    init,
    heldCount => {
      releasePool = new Pool(heldCount)
      releasePool.hold(heldCount)
      const holdPool = new Pool(heldCount)
      return func({
        holdPool,
        abortSignal: abortSignal ?? null,
        release,
      })
    },
    () => {
      // Fire-and-forget: the unawaited release still runs to completion,
      // so the caller need not wait for an async pool's release delay (e.g. TimeLimitPool)
      void release(releasePool!.heldCount)
    },
  )
}
