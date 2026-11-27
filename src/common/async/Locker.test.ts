import { describe, it, expect } from 'vitest'
import { Locker, LockerWithId } from './Locker'
import { ManualPromise } from './promise/ManualPromise'

describe('Locker', () => {
  it('base', async () => {
    const locker = new Locker()
    expect(locker.hasQueued).toBe(false)
    expect(locker.lock(() => 1)).toBe(1)
    expect(locker.hasQueued).toBe(false)
    const result = locker.lock(async () => 2)
    expect(locker.hasQueued).toBe(true)
    expect(await result).toBe(2)
    expect(locker.hasQueued).toBe(false)
  })

  it('operations run one at a time in the order of the calls', async () => {
    const locker = new Locker()
    const events: string[] = []
    const ends = [new ManualPromise(), new ManualPromise(), new ManualPromise()]
    const results: Promise<void>[] = []
    for (let i = 0; i < ends.length; i++) {
      results.push(
        locker.lock(async () => {
          events.push(`start ${i}`)
          await ends[i].promise
          events.push(`end ${i}`)
        }),
      )
    }
    expect(events).toEqual(['start 0'])

    ends[2].resolve()
    ends[1].resolve()
    ends[0].resolve()
    await results[0]
    expect(locker.hasQueued).toBe(true)

    await Promise.all(results)
    expect(events).toEqual([
      'start 0',
      'end 0',
      'start 1',
      'end 1',
      'start 2',
      'end 2',
    ])
    expect(locker.hasQueued).toBe(false)
  })

  it('an operation that throws or rejects lets the next one run', async () => {
    const locker = new Locker()
    const result0 = locker.lock(() => Promise.reject(new Error('error 0')))
    const result1 = locker.lock(() => {
      throw new Error('error 1')
    })
    const result2 = locker.lock(() => 2)
    await expect(result0).rejects.toThrow('error 0')
    await expect(result1).rejects.toThrow('error 1')
    expect(await result2).toBe(2)
    expect(locker.hasQueued).toBe(false)
  })
})

describe('LockerWithId', () => {
  it('a third call of an id waits while the second one runs', async () => {
    const locker = new LockerWithId<string>()
    const events: string[] = []
    const ends = [new ManualPromise(), new ManualPromise(), new ManualPromise()]
    function lock(index: number) {
      return locker.lock('id', async () => {
        events.push(`start ${index}`)
        await ends[index].promise
        events.push(`end ${index}`)
      })
    }

    const result0 = lock(0)
    const result1 = lock(1)
    ends[0].resolve()
    await result0
    expect(events).toEqual(['start 0', 'end 0', 'start 1'])

    const result2 = lock(2)
    expect(events).toEqual(['start 0', 'end 0', 'start 1'])
    expect(locker.hasQueued('id')).toBe(true)

    ends[1].resolve()
    ends[2].resolve()
    await Promise.all([result1, result2])
    expect(events).toEqual([
      'start 0',
      'end 0',
      'start 1',
      'end 1',
      'start 2',
      'end 2',
    ])
    expect(locker.hasQueued('id')).toBe(false)
  })
})
