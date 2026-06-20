import { describe, it } from 'vitest'
import { calcPerformanceAsync } from 'rdtsc'
import { TimeControllerMock } from '@flemist/time-controller'
import { TimeLimitPool } from './TimeLimitPool'
import { Pool } from 'src/common/async/pool/Pool'
import { poolRunWait } from 'src/common/async/pool/poolRunWait'
import { Pools } from 'src/common/async/pool/Pools'

describe('time-limits > TimeLimits perf', { timeout: 600000 }, () => {
  it('base', async () => {
    const emptyFunc = () => {}
    const timeController = new TimeControllerMock()
    const timeLimitPool = new TimeLimitPool({
      pool: new Pool(1),
      time: 1,
      timeController,
    })
    const timeLimitsPool = new Pools(timeLimitPool)

    const count = 100

    const result = await calcPerformanceAsync({
      time: 10000,
      funcs: [
        async () => {
          const promises: Promise<any>[] = []
          for (let i = 0; i < count; i++) {
            promises.push(
              poolRunWait({
                pool: timeLimitsPool,
                count: 1,
                func: emptyFunc,
              }),
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
