import { describe, it, expect } from 'vitest'
import { AbortControllerFast } from '@flemist/abort-controller-fast'
import { delay } from 'src/common/async/wait/delay'
import { waitMicrotasks } from 'src/common/async/wait/waitMicrotasks'
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

  it('a delay function that throws rejects the merged delay without an unhandled rejection', async () => {
    const error = new Error('delay error')
    const mergedDelay = getMergedDelay(
      () => ({ delay: (_, delayAbortSignal) => delay(1000, delayAbortSignal) }),
      () => ({
        delay: () => {
          throw error
        },
      }),
    )
    const delayAbortController = new AbortControllerFast()
    await expect(mergedDelay(status, delayAbortController.signal)).rejects.toBe(
      error,
    )
    // A caller aborts the delay after the error.
    // The first delay function rejects then.
    // Vitest fails the run if that rejection has no handler
    delayAbortController.abort()
    await waitMicrotasks()
  })
})
