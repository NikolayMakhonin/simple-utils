import { describe, it, expect, vi } from 'vitest'
import { Cache } from './Cache'
import { MemoryStorage } from './MemoryStorage'
import type { CacheStat } from './types'

describe('Cache', () => {
  function createCache() {
    const storages = {
      value: new MemoryStorage<string, number>(),
      error: new MemoryStorage<string, unknown>(),
      stat: new MemoryStorage<string, CacheStat>(),
    }
    const cache = new Cache<
      string,
      number,
      unknown,
      string,
      number,
      unknown,
      CacheStat
    >({
      storages,
      getSize: { value: () => 1, error: () => 1, stat: () => 0 },
    })
    return { cache, storages }
  }

  it('base', async () => {
    const { cache } = createCache()
    expect(await cache.getOrCreate('a', () => 1)).toBe(1)
    expect(await cache.getOrCreate('a', () => 2)).toBe(1)
    await expect(
      cache.getOrCreate('b', () => {
        throw new Error('error b')
      }),
    ).rejects.toThrow('error b')
    await expect(cache.getOrCreate('b', () => 3)).rejects.toThrow('error b')
  })

  it('a hit reads exclusively the storage of its value or of its error', async () => {
    const { cache, storages } = createCache()
    await cache.getOrCreate('a', () => 1)
    await expect(
      cache.getOrCreate('b', () => {
        throw new Error('error b')
      }),
    ).rejects.toThrow('error b')
    const valueGet = vi.spyOn(storages.value, 'get')
    const errorGet = vi.spyOn(storages.error, 'get')
    await cache.getOrCreate('a', () => 2)
    expect(valueGet).toHaveBeenCalledTimes(1)
    expect(errorGet).toHaveBeenCalledTimes(0)
    await expect(cache.getOrCreate('b', () => 3)).rejects.toThrow('error b')
    expect(valueGet).toHaveBeenCalledTimes(1)
    expect(errorGet).toHaveBeenCalledTimes(1)
  })

  it('a failed load of the stats is repeated by the next call', async () => {
    const { cache, storages } = createCache()
    const error = new Error('stat load error')
    vi.spyOn(storages.stat, 'getEntries').mockRejectedValueOnce(error)
    await expect(cache.getOrCreate('a', () => 1)).rejects.toBe(error)
    expect(await cache.getOrCreate('a', () => 2)).toBe(2)
  })
})
