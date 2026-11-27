import { describe, it, expect } from 'vitest'
import { AbortControllerFast } from '@flemist/abort-controller-fast'
import { promiseToAbortable } from './promiseToAbortable'
import { ManualPromise } from '../promise/ManualPromise'

describe('promiseToAbortable', () => {
  it('base', async () => {
    const promise = Promise.resolve(1)
    expect(promiseToAbortable(null, promise)).toBe(promise)
    expect(
      await promiseToAbortable(new AbortControllerFast().signal, promise),
    ).toBe(1)
    const abortController = new AbortControllerFast()
    abortController.abort('reason')
    await expect(
      promiseToAbortable(abortController.signal, promise),
    ).rejects.toBe('reason')
  })

  it('the first of an abort and a rejection decides the result', async () => {
    const abortController1 = new AbortControllerFast()
    const promise1 = new ManualPromise()
    const result1 = promiseToAbortable(
      abortController1.signal,
      promise1.promise,
    )
    abortController1.abort('reason')
    promise1.reject(new Error('error'))
    await expect(result1).rejects.toBe('reason')

    const abortController2 = new AbortControllerFast()
    const promise2 = new ManualPromise()
    const result2 = promiseToAbortable(
      abortController2.signal,
      promise2.promise,
    )
    promise2.reject(new Error('error'))
    await expect(result2).rejects.toThrow('error')
    abortController2.abort('reason')
  })
})
