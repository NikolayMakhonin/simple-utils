import { describe, it } from 'vitest'
import { calcPerformanceAsync } from 'rdtsc'
import { TimeControllerMock } from '@flemist/time-controller'
import { createAwaitPriority } from 'src/common/async/priority-queue/helpers'
import { TimeLimitPool } from './TimeLimitPool'
import { Pool } from 'src/common/async/pool/Pool'
import { PoolRunner } from 'src/common/async/pool/PoolRunner'
import { Pools } from 'src/common/async/pool/Pools'

describe('time-limits > TimeLimits perf', { timeout: 600000 }, () => {
  it('base', async () => {
    const emptyFunc = o => o
    const awaitPriority = createAwaitPriority()
    const timeController = new TimeControllerMock()
    const timeLimit = new PoolRunner(
      new TimeLimitPool({
        pool: new Pool(1),
        time: 1,
        timeController,
      }),
    )
    const timeLimits = new PoolRunner(new Pools(timeLimit.pool))

    const count = 100

    const result = await calcPerformanceAsync({
      time: 10000,
      funcs: [
        async () => {
          const promises: Promise<any>[] = []
          for (let i = 0; i < count; i++) {
            promises.push(
              timeLimits.run(1, emptyFunc, null, null, awaitPriority),
            )
          }
          for (let i = 0; i < count; i++) {
            timeController.addTime(1)
            await 0
            await 0
            await 0
            await 0
            await 0
            await 0
            await 0
          }
          timeController.addTime(1)
          await Promise.all(promises)
        },
      ],
    })

    console.log(result)
  })
})
