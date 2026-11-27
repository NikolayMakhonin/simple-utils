import { describe, it, expect } from 'vitest'
import { runWithFinally } from './runWithFinally'

describe('runWithFinally', () => {
  it('base', async () => {
    const events: string[] = []
    function onFinally() {
      events.push('finally')
    }

    expect(runWithFinally(null, () => 1, onFinally)).toBe(1)
    expect(events).toEqual(['finally'])

    const result = runWithFinally(null, async () => 2, onFinally)
    expect(events).toEqual(['finally'])
    expect(await result).toBe(2)
    expect(events).toEqual(['finally', 'finally'])

    expect(
      runWithFinally(
        () => 3,
        context => context + 1,
        null,
      ),
    ).toBe(4)
    expect(
      await runWithFinally(
        async () => 5,
        context => context + 1,
        onFinally,
      ),
    ).toBe(6)
    expect(events).toEqual(['finally', 'finally', 'finally'])
  })

  it('onFinally runs once when it throws after func returns a value', () => {
    let count = 0
    expect(() =>
      runWithFinally(
        null,
        () => 1,
        () => {
          count++
          throw new Error('error of onFinally')
        },
      ),
    ).toThrow('error of onFinally')
    expect(count).toBe(1)
  })
})
