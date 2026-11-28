import { describe, it, expect } from 'vitest'
import { AbortControllerFast } from '@flemist/abort-controller-fast'
import { mergeRepeatStrategies } from './mergeRepeatStrategies'
import { createTask } from './TaskBase'
import type { TaskRepeatStrategy, TaskRepeatStrategyDelay } from './types'

describe('mergeRepeatStrategies', () => {
  const status = createTask(() => {}, null).status
  const abortSignal = new AbortControllerFast().signal

  function getMergedDelay(
    ...strategies: TaskRepeatStrategy[]
  ): TaskRepeatStrategyDelay {
    const delay = mergeRepeatStrategies(...strategies)(status)?.delay
    if (typeof delay !== 'function') {
      throw new Error('[test] the merged strategy has no delay function')
    }
    return delay
  }

  it('the results of the delay functions apply in the order of the strategies', async () => {
    // The first result comes later, and still the second one replaces it
    const mergedDelay = getMergedDelay(
      () => ({ delay: () => Promise.resolve().then(() => ({ stop: true })) }),
      () => ({ delay: () => ({ stop: false, delay: 5 }) }),
    )
    expect(await mergedDelay(status, abortSignal)).toEqual({
      stop: false,
      stopReason: undefined,
      delay: 5,
    })
  })

  it('a delay function that rejects while an earlier one waits rejects the merged delay', async () => {
    const error = new Error('delay error')
    const mergedDelay = getMergedDelay(
      () => ({ delay: () => new Promise<void>(() => {}) }),
      () => ({ delay: () => Promise.reject(error) }),
    )
    await expect(mergedDelay(status, abortSignal)).rejects.toBe(error)
  })
})
