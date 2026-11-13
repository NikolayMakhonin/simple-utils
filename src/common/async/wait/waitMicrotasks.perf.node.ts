import { describe, it } from 'vitest'
import { calcPerformanceAsync } from 'rdtsc'
import { EMPTY_FUNC } from 'src/common/constants'
import { waitMicrotasks } from './waitMicrotasks'

describe('waitMicrotasks perf', () => {
  it('vs a loop of 16 awaits', { timeout: 60 * 60 * 1000 }, async () => {
    const result = await calcPerformanceAsync({
      time: 1000,
      funcs: [
        async () => {
          for (let i = 0; i < 16; i++) {
            await Promise.resolve().then(EMPTY_FUNC)
          }
        },
        () => {
          return waitMicrotasks()
        },
      ],
    })
    console.log(
      '[test][waitMicrotasks] CPU cycles per call' +
        '; funcs: 16 x await Promise.resolve().then(), waitMicrotasks()',
      result,
    )
  })
})
