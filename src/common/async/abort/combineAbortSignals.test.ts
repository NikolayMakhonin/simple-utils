import { describe, it, expect } from 'vitest'
import { AbortControllerFast } from '@flemist/abort-controller-fast'
import { combineAbortSignals } from './combineAbortSignals'
import { FakeAbortSignal } from './-test/FakeAbortSignal'

describe('combineAbortSignals', () => {
  it('base', () => {
    const abortController1 = new AbortControllerFast()
    const abortController2 = new AbortControllerFast()
    const combined = combineAbortSignals(
      abortController1.signal,
      null,
      abortController2.signal,
    )
    expect(combined.aborted).toBe(false)
    const reasons: unknown[] = []
    combined.subscribe(reason => {
      reasons.push(reason)
    })
    abortController2.abort('reason 2')
    expect(combined.aborted).toBe(true)
    expect(combined.reason).toBe('reason 2')
    abortController1.abort('reason 1')
    expect(combined.reason).toBe('reason 2')
    expect(reasons).toEqual(['reason 2'])

    const combinedIdle = combineAbortSignals(abortController1.signal)
    expect(combinedIdle.aborted).toBe(true)
    expect(combinedIdle.reason).toBe('reason 1')
  })

  it('a callback subscribed twice throws and leaves no subscription on the signals', () => {
    const abortSignal = new FakeAbortSignal()
    const combined = combineAbortSignals(abortSignal)
    const callback = () => {}
    const unsubscribe = combined.subscribe(callback)
    expect(() => combined.subscribe(callback)).toThrow('Already subscribed')
    unsubscribe()
    expect(abortSignal.subscriptionCount).toBe(0)
  })
})
