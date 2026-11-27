import { describe, it, expect } from 'vitest'
import { Lazy, LazyWithId } from './lazy'
import { ManualPromise } from './promise/ManualPromise'

describe('Lazy', () => {
  it('base', async () => {
    let count = 0
    const lazy = new Lazy({ func: () => ++count })
    expect(lazy.run()).toBe(1)
    expect(lazy.run()).toBe(2)

    const lazyPersist = new Lazy({ func: () => ++count, persist: true })
    expect(lazyPersist.run()).toBe(3)
    expect(lazyPersist.run()).toBe(3)

    const lazyAsync = new Lazy({ func: async () => ++count })
    const result = lazyAsync.run()
    expect(lazyAsync.run()).toBe(result)
    expect(await result).toBe(4)
    expect(await lazyAsync.run()).toBe(5)
  })

  it('a value from set during a run stays after the run resolves', async () => {
    const end = new ManualPromise<number>()
    const lazy = new Lazy({ func: () => end.promise, persist: true })
    const result = lazy.run()
    lazy.set(2)
    end.resolve(1)
    expect(await result).toBe(1)
    expect(lazy.run()).toBe(2)
  })
})

describe('LazyWithId', () => {
  it('base', () => {
    let count = 0
    const lazy = new LazyWithId<string, string>({
      func: id => id + ++count,
      persist: true,
    })
    expect(lazy.run('a')).toBe('a1')
    expect(lazy.run('b')).toBe('b2')
    expect(lazy.run('a')).toBe('a1')
  })

  it('a value from set during a run stays after the run resolves', async () => {
    const end = new ManualPromise<number>()
    const lazy = new LazyWithId<string, number>({
      func: () => end.promise,
      persist: true,
    })
    const result = lazy.run('a')
    lazy.set('a', 2)
    end.resolve(1)
    expect(await result).toBe(1)
    expect(lazy.run('a')).toBe(2)
  })
})
