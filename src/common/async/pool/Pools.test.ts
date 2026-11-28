import { describe, it, expect } from 'vitest'
import { Pool } from './Pool'
import { Pools } from './Pools'
import { FakeAbortSignal } from 'src/common/async/abort/-test/FakeAbortSignal'

describe('Pools', () => {
  it('a tick leaves no subscription on the abort signal after it resolves', async () => {
    const abortSignal = new FakeAbortSignal()
    const pool1 = new Pool(1)
    const pool2 = new Pool(1)
    pool1.hold(1)
    pool2.hold(1)
    const pools = new Pools(pool1, pool2)
    const tick = pools.tick(abortSignal)
    pool1.release(1)
    await tick
    expect(abortSignal.subscriptionCount).toBe(0)
  })
})
