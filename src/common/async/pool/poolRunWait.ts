import { poolWait } from './Pool'
import { type Priority } from 'src/common/async/priority/Priority'
import type { PromiseLikeOrValue } from 'src/common/types/common'
import { type PoolRunArgs, poolRunBase } from './poolRunBase'
import { toPromise } from 'src/common/async/promise/toPromise'

export type PoolRunWaitArgs<T> = PoolRunArgs<T> & {
  priority?: null | Priority
}

export function poolRunWait<T>({
  pool,
  count,
  func,
  priority,
  abortSignal,
}: PoolRunWaitArgs<PromiseLikeOrValue<T>>): Promise<T> {
  return toPromise(
    poolRunBase({
      pool,
      func,
      abortSignal,
      init: async () => {
        await poolWait({
          pool: pool!,
          count,
          hold: true,
          priority,
          abortSignal,
        })
        return count
      },
    }),
  )
}
