import { describe, it, expect } from 'vitest'
import { createTaskRepeated } from './TaskRepeated'
import type { TaskRepeatStrategyBefore } from './types'

describe('TaskRepeated', () => {
  it('a stop before the first execution rejects the run', async () => {
    const { repeated } = createTaskRepeated(() => 1, null, {
      repeatStrategy: () => ({ stop: true }),
    })
    await expect(repeated.run()).rejects.toThrow(
      '[TaskRepeated] stopped before the first execution',
    )
  })

  it('a delay of NaN rejects the run after the first execution', async () => {
    async function test(delay: TaskRepeatStrategyBefore<number>['delay']) {
      let executions = 0
      let strategyCalls = 0
      const { repeated } = createTaskRepeated(
        () => {
          executions++
          return executions
        },
        null,
        {
          // The stop after 3 calls ends the run if a NaN delay does not reject it
          repeatStrategy() {
            strategyCalls++
            if (strategyCalls > 3) {
              return { stop: true }
            }
            return { delay }
          },
        },
      )
      await expect(repeated.run()).rejects.toThrow(
        '[delay] milliseconds must be a finite number: NaN',
      )
      expect(executions).toBe(1)
    }

    await test(NaN)
    await test(() => NaN)
  })
})
