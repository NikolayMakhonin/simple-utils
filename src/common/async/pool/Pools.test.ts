import { describe, it, expect } from 'vitest'
import type { IAbortSignalFast } from '@flemist/abort-controller-fast'
import { Pool } from './Pool'
import { Pools } from './Pools'

describe('Pools', () => {
  it('a tick leaves no subscription on the abort signal after it resolves', async () => {
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
    const pool1 = new Pool(1)
    const pool2 = new Pool(1)
    pool1.hold(1)
    pool2.hold(1)
    const pools = new Pools(pool1, pool2)
    const tick = pools.tick(abortSignal)
    pool1.release(1)
    await tick
    expect(subscriptionCount).toBe(0)
  })
})
