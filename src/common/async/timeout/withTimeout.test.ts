import { describe, it, expect } from 'vitest'
import { AbortControllerFast, AbortError } from '@flemist/abort-controller-fast'
import { withTimeout } from './withTimeout'

describe('withTimeout', () => {
  it('base', async () => {
    expect(await withTimeout(() => 1, null)).toBe(1)
    expect(await withTimeout(async () => 2, { timeout: 1000 })).toBe(2)
    await expect(
      withTimeout(() => Promise.reject(new Error('error')), { timeout: 1000 }),
    ).rejects.toThrow('error')
  })

  it('rejects when the timeout passes, also while func ignores the signal', async () => {
    await expect(
      withTimeout(() => new Promise(() => {}), { timeout: 1 }),
    ).rejects.toThrow(AbortError)
  })

  it('rejects with the reason of an abort of args.abortSignal', async () => {
    const abortController = new AbortControllerFast()
    const result = withTimeout(() => new Promise(() => {}), {
      abortSignal: abortController.signal,
    })
    abortController.abort('reason')
    await expect(result).rejects.toBe('reason')
  })
})
