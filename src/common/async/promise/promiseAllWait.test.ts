import { describe, it, expect } from 'vitest'
import { promiseAllWait } from './promiseAllWait'
import { ManualPromise } from './ManualPromise'
import { waitMicrotasks } from '../wait/waitMicrotasks'

describe('promiseAllWait', () => {
  it('base', async () => {
    expect(await promiseAllWait([])).toEqual([])
    expect(await promiseAllWait([1, Promise.resolve(2), undefined])).toEqual([
      1,
      2,
      undefined,
    ])
  })

  it('rejects after all promises settle, with the first rejected one of the array', async () => {
    const promises = [
      new ManualPromise(),
      new ManualPromise(),
      new ManualPromise(),
    ]
    let isSettled = false
    const result = promiseAllWait([
      promises[0].promise,
      promises[1].promise,
      promises[2].promise,
    ]).finally(() => {
      isSettled = true
    })
    promises[2].reject(new Error('error 2'))
    await waitMicrotasks()
    expect(isSettled).toBe(false)

    promises[1].reject(new Error('error 1'))
    promises[0].resolve()
    await expect(result).rejects.toThrow('error 1')
  })
})
