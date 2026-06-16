import { Pool } from './Pool'
import type {
  PromiseLikeOrValue,
  PromiseOrValue,
} from 'src/common/types/common'
import { runWithFinally } from 'src/common/async/runWithFinally'
import { promiseLikeToPromise } from 'src/common/async/promise/promiseLikeToPromise'
import { PoolHoldError } from './PoolHoldError'
import type { PoolRunArgs } from './poolRunWait'

export function poolRunThrow<Result>(args: PoolRunArgs<Result>): Result
export function poolRunThrow<Result>(
  args: PoolRunArgs<PromiseLikeOrValue<Result>>,
): PromiseOrValue<Result>
export function poolRunThrow<Result>({
  pool,
  count,
  func,
  abortSignal,
}: PoolRunArgs<PromiseLikeOrValue<Result>>): PromiseOrValue<Result> {
  if (pool == null) {
    const holdPool = new Pool(count)
    return promiseLikeToPromise(func(holdPool, abortSignal))
  }
  return promiseLikeToPromise(
    runWithFinally(
      () => {
        if (!pool.hold(count)) {
          throw new PoolHoldError(count)
        }
      },
      () => {
        const holdPool = new Pool(count)
        return func(holdPool, abortSignal)
      },
      () => {
        // We should not wait for release
        pool.release(count)
      },
    ),
  )
}
