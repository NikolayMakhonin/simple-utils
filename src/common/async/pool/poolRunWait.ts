import { poolWait } from './Pool'
import { type AwaitPriority } from 'src/common/async/priority-queue/helpers'
import { type Priority } from 'src/common/async/priority/Priority'
import type { PromiseLikeOrValue } from 'src/common/types/common'
import { type PoolRunArgs, poolRunBase } from './poolRunBase'
import { toPromise } from 'src/common/async/promise/toPromise'

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
          awaitPriority,
        })
        return count
      },
    }),
  )
}
