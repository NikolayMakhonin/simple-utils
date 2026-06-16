import { type IPool } from './Pool'
import type {
  PromiseLikeOrValue,
  PromiseOrValue,
} from 'src/common/types/common'
import { runWithFinally } from 'src/common/async/runWithFinally'
import { promiseLikeToPromise } from 'src/common/async/promise/promiseLikeToPromise'
import { PoolHoldError } from './PoolHoldError'

export function poolRunThrow<Result>(
  pool: IPool,
  count: number,
  func: (() => Result) | null | undefined,
): Result
export function poolRunThrow<Result>(
  pool: IPool,
  count: number,
  func: (() => PromiseLikeOrValue<Result>) | null | undefined,
): PromiseOrValue<Result>
export function poolRunThrow<Result>(
  pool: IPool,
  count: number,
  func: (() => PromiseLikeOrValue<Result>) | null | undefined,
): PromiseOrValue<Result> {
  return promiseLikeToPromise(
    runWithFinally(
      () => {
        const hold = pool.hold(count)
        if (!hold) {
          throw new PoolHoldError(count)
        }
      },
      func!,
      () => {
        void pool.release(count)
      },
    ),
  )
}
