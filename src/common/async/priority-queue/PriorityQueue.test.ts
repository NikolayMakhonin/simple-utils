import { describe, it, expect } from 'vitest'
import { PriorityQueue } from './PriorityQueue'
import { AbortSignalMock } from 'src/common/async/abort/-test/AbortSignalMock'

describe('PriorityQueue', () => {
  it('a run unsubscribes from the abort signal when it leaves the queue', async () => {
    const abortSignal = new AbortSignalMock()
    const queue = new PriorityQueue()
    expect(await queue.run(() => 1, null, abortSignal)).toBe(1)
    expect(await queue.run(async () => 2, null, abortSignal)).toBe(2)
    expect(abortSignal.subscriptionCount).toBe(0)
  })
})
