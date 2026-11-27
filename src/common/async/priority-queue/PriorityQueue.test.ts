import { describe, it, expect } from 'vitest'
import type { IAbortSignalFast } from '@flemist/abort-controller-fast'
import { PriorityQueue } from './PriorityQueue'

describe('PriorityQueue', () => {
  it('a run unsubscribes from the abort signal when it leaves the queue', async () => {
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
    const queue = new PriorityQueue()
    expect(await queue.run(() => 1, null, abortSignal)).toBe(1)
    expect(await queue.run(async () => 2, null, abortSignal)).toBe(2)
    expect(subscriptionCount).toBe(0)
  })
})
