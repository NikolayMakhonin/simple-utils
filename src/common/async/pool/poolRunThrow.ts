import type {
  PromiseLikeOrValue,
  PromiseOrValue,
} from 'src/common/types/common'
import { PoolHoldError } from './PoolHoldError'
import type { PoolRunArgs } from './poolRunBase'
import { poolRunBase } from './poolRunBase'

export function poolRunThrow<Result>(
  args: PoolRunArgs<PromiseLike<Result>>,
): Promise<Result>
export function poolRunThrow<Result>(
  args: PoolRunArgs<PromiseLikeOrValue<Result>>,
): PromiseOrValue<Result>
export function poolRunThrow<Result>(args: PoolRunArgs<Result>): Result
export function poolRunThrow<Result>({
  pool,
  count,
  func,
  abortSignal,
}: PoolRunArgs<PromiseLikeOrValue<Result>>): PromiseOrValue<Result> {
  return poolRunBase({
    pool,
    func,
    abortSignal,
    init: () => {
      if (!pool!.hold(count)) {
        throw new PoolHoldError(count)
      }
      return count
    },
  })
}
