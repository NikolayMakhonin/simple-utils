import { describe, it, expect } from 'vitest'
import { AbortControllerFast } from '@flemist/abort-controller-fast'
import { delay } from './delay'

describe('delay', () => {
  it('base', async () => {
    await expect(delay(null)).resolves.toBeUndefined()
    await expect(delay(undefined)).resolves.toBeUndefined()
    await expect(delay(0)).resolves.toBeUndefined()
    await expect(delay(-1)).resolves.toBeUndefined()
    await expect(delay(1)).resolves.toBeUndefined()
    const abortSignal = new AbortControllerFast().signal
    await expect(delay(0, abortSignal)).resolves.toBeUndefined()
    await expect(delay(1, abortSignal)).resolves.toBeUndefined()
  })

  it('an aborted signal rejects for every duration', async () => {
    const abortController = new AbortControllerFast()
    abortController.abort('reason')
    await expect(delay(null, abortController.signal)).rejects.toBe('reason')
    await expect(delay(0, abortController.signal)).rejects.toBe('reason')
    await expect(delay(10, abortController.signal)).rejects.toBe('reason')
  })

  it('an abort during the delay rejects with its reason', async () => {
    const abortController = new AbortControllerFast()
    const result = delay(1000, abortController.signal)
    abortController.abort('reason')
    await expect(result).rejects.toBe('reason')
  })

  it('errors', () => {
    const abortController = new AbortControllerFast()
    abortController.abort('reason')
    expect(() => delay(NaN)).toThrow(TypeError)
    expect(() => delay(Infinity)).toThrow(TypeError)
    expect(() => delay(NaN, abortController.signal)).toThrow(TypeError)
  })
})
