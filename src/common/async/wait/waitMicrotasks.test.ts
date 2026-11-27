import { describe, it, assert, expect } from 'vitest'
import {
  AbortControllerFast,
  type IAbortSignalFast,
} from '@flemist/abort-controller-fast'
import { waitMicrotasks } from './waitMicrotasks'

describe('waitMicrotasks', () => {
  it('stress', async () => {
    let resolvedActual = 0
    function createMicrotasksTree(levels: number, countPerLevel: number) {
      if (levels === 0) {
        resolvedActual++
        return 1
      }
      for (let i = 0; i < countPerLevel; i++) {
        Promise.resolve().then(() =>
          createMicrotasksTree(levels - 1, countPerLevel),
        )
      }
      return countPerLevel ** levels
    }
    for (let i = 0; i < 5; i++) {
      resolvedActual = 0
      const resolvedExpected = createMicrotasksTree(i, i)
      await waitMicrotasks()
      assert.strictEqual(resolvedActual, resolvedExpected)
    }
  })

  it('unsubscribes from the abort signal after the wait', async () => {
    let subscriptionCount = 0
    const abortSignal: IAbortSignalFast = {
      aborted: false,
      reason: undefined,
      throwIfAborted() {},
      subscribe() {
        subscriptionCount++
        return () => {
          subscriptionCount--
        }
      },
    }
    await waitMicrotasks(abortSignal)
    await waitMicrotasks(abortSignal)
    expect(subscriptionCount).toBe(0)
  })

  it('rejects with the reason of an abort before the wait ends', async () => {
    const abortController = new AbortControllerFast()
    const result = waitMicrotasks(abortController.signal)
    abortController.abort('reason')
    await expect(result).rejects.toBe('reason')
    await expect(waitMicrotasks(abortController.signal)).rejects.toBe('reason')
  })
})
