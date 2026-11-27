import { describe, it, expect } from 'vitest'
import { AbortControllerFast } from '@flemist/abort-controller-fast'
import { withAbortSignal } from './withAbortSignal'
import { ManualPromise } from '../promise/ManualPromise'

describe('withAbortSignal', () => {
  it('base', async () => {
    expect(withAbortSignal({ func: () => 1, abortSignal: null })).toBe(1)
    const abortSignal = new AbortControllerFast().signal
    expect(withAbortSignal({ func: () => 2, abortSignal })).toBe(2)
    expect(await withAbortSignal({ func: async () => 3, abortSignal })).toBe(3)
  })

  it('onAbort runs when the signal aborts while func runs', async () => {
    const abortController = new AbortControllerFast()
    const reasons: unknown[] = []
    const end = new ManualPromise()
    const result = withAbortSignal({
      func: () => end.promise,
      abortSignal: abortController.signal,
      onAbort: reason => {
        reasons.push(reason)
      },
    })
    abortController.abort('reason')
    expect(reasons).toEqual(['reason'])
    end.resolve()
    await result
  })

  it('a signal that is already aborted throws without calling func and onAbort', () => {
    const abortController = new AbortControllerFast()
    abortController.abort(new Error('reason'))
    const calls: string[] = []
    expect(() =>
      withAbortSignal({
        func: () => {
          calls.push('func')
        },
        abortSignal: abortController.signal,
        onAbort: () => {
          calls.push('onAbort')
        },
      }),
    ).toThrow('reason')
    expect(calls).toEqual([])
  })
})
