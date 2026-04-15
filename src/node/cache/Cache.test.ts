import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import * as path from 'path'
import * as fs from 'fs'
import { Cache, type CacheStat } from 'src/common/cache/Cache'
import { createFileCacheOptions } from './createFileCacheOptions'

const DIR_TMP = 'tmp/node/cache/fileCache'
const DIR_CACHE = path.join(DIR_TMP, 'cache')
const DIR_CACHE_TMP = path.join(DIR_TMP, 'tmp')

let runCounter = 0

function getDirs() {
  runCounter++
  const dirCase = path.join(DIR_CACHE, `case-${runCounter}`)
  const dirCaseTmp = path.join(DIR_CACHE_TMP, `case-${runCounter}`)
  return { dir: dirCase, tmpDir: dirCaseTmp }
}

async function resetDir(dir: string) {
  await fs.promises.rm(dir, { recursive: true, force: true })
}

beforeEach(async () => {
  await resetDir(DIR_TMP)
})

afterAll(async () => {
  await resetDir(DIR_TMP)
})

function createCache<Input = any, Value = any>(options?: {
  dir?: string
  tmpDir?: string
  isExpired?: null | ((stat: CacheStat) => boolean)
}) {
  const dirs = getDirs()
  const dir = options?.dir ?? dirs.dir
  const tmpDir = options?.tmpDir ?? dirs.tmpDir
  const cache = new Cache<
    Input,
    Value,
    any,
    string,
    Uint8Array,
    Uint8Array,
    Uint8Array
  >(
    createFileCacheOptions<Input, Value>({
      dir,
      tmpDir,
      isExpired: options?.isExpired,
    }),
  )
  return { cache, dir, tmpDir }
}

async function delay(ms: number) {
  await new Promise(resolve => setTimeout(resolve, ms))
}

describe('Cache', () => {
  describe('getOrCreate', () => {
    it('base', async () => {
      const { cache } = createCache<string, number>()
      let calls = 0
      const result = await cache.getOrCreate('input1', () => {
        calls++
        return 42
      })
      expect(result).toBe(42)
      expect(calls).toBe(1)
    })

    it('caches value on first call and returns cached value on subsequent calls', async () => {
      const { cache } = createCache<string, number>()
      let calls = 0
      const result1 = await cache.getOrCreate('input', () => {
        calls++
        return 100
      })
      const result2 = await cache.getOrCreate('input', () => {
        calls++
        return 200
      })
      const result3 = await cache.getOrCreate('input', () => {
        calls++
        return 300
      })
      expect(result1).toBe(100)
      expect(result2).toBe(100)
      expect(result3).toBe(100)
      expect(calls).toBe(1)
    })

    it('creates separate entries for different inputs', async () => {
      const { cache } = createCache<string, number>()
      const a = await cache.getOrCreate('a', () => 1)
      const b = await cache.getOrCreate('b', () => 2)
      const c = await cache.getOrCreate('c', () => 3)
      expect([a, b, c]).toEqual([1, 2, 3])
      const a2 = await cache.getOrCreate('a', () => 999)
      const b2 = await cache.getOrCreate('b', () => 999)
      const c2 = await cache.getOrCreate('c', () => 999)
      expect([a2, b2, c2]).toEqual([1, 2, 3])
    })

    it('returns same value when inputs hash to same key', async () => {
      const { cache } = createCache<any, number>()
      const first = await cache.getOrCreate({ a: 1, b: 2 }, () => 111)
      const second = await cache.getOrCreate({ b: 2, a: 1 }, () => 222)
      expect(first).toBe(111)
      expect(second).toBe(111)
    })

    it('persists values to the filesystem across Cache instances', async () => {
      const { cache: cache1, dir, tmpDir } = createCache<string, string>()
      await cache1.getOrCreate('k1', () => 'v1')
      const cache2 = new Cache<
        string,
        string,
        any,
        string,
        Uint8Array,
        Uint8Array,
        Uint8Array
      >(createFileCacheOptions<string, string>({ dir, tmpDir }))
      let calls = 0
      const result = await cache2.getOrCreate('k1', () => {
        calls++
        return 'new-value'
      })
      expect(result).toBe('v1')
      expect(calls).toBe(0)
    })

    it('stores complex serializable values', async () => {
      const { cache } = createCache<string, any>()
      const value = {
        num: 42,
        str: 'text',
        bool: true,
        nul: null,
        arr: [1, 2, 3, { nested: 'ok' }],
        obj: { deep: { deeper: { deepest: 'value' } } },
      }
      const stored = await cache.getOrCreate('complex', () => value)
      expect(stored).toEqual(value)
      const read = await cache.getOrCreate('complex', () => ({
        should: 'not-run',
      }))
      expect(read).toEqual(value)
    })

    it('stores arrays as top-level values', async () => {
      const { cache } = createCache<string, number[]>()
      const result = await cache.getOrCreate('arr', () => [1, 2, 3, 4, 5])
      expect(result).toEqual([1, 2, 3, 4, 5])
      const cached = await cache.getOrCreate('arr', () => [])
      expect(cached).toEqual([1, 2, 3, 4, 5])
    })

    it('stores strings as top-level values', async () => {
      const { cache } = createCache<string, string>()
      const result = await cache.getOrCreate('s', () => 'hello')
      expect(result).toBe('hello')
      const cached = await cache.getOrCreate('s', () => 'other')
      expect(cached).toBe('hello')
    })

    it('stores empty string values', async () => {
      const { cache } = createCache<string, string>()
      const result = await cache.getOrCreate('e', () => '')
      expect(result).toBe('')
      const cached = await cache.getOrCreate('e', () => 'other')
      expect(cached).toBe('')
    })

    it('stores zero, false, and null values as distinct cache hits', async () => {
      const { cache } = createCache<string, any>()
      let calls = 0
      const zero = await cache.getOrCreate('zero', () => {
        calls++
        return 0
      })
      const falsy = await cache.getOrCreate('false', () => {
        calls++
        return false
      })
      const nul = await cache.getOrCreate('null', () => {
        calls++
        return null
      })
      expect([zero, falsy, nul]).toEqual([0, false, null])
      expect(calls).toBe(3)
      const zero2 = await cache.getOrCreate('zero', () => {
        calls++
        return 999
      })
      const falsy2 = await cache.getOrCreate('false', () => {
        calls++
        return true
      })
      const nul2 = await cache.getOrCreate('null', () => {
        calls++
        return 'xxx'
      })
      expect([zero2, falsy2, nul2]).toEqual([0, false, null])
      expect(calls).toBe(3)
    })

    it('handles async func returning a promise', async () => {
      const { cache } = createCache<string, number>()
      let calls = 0
      const result = await cache.getOrCreate('async', async () => {
        calls++
        await delay(10)
        return 777
      })
      expect(result).toBe(777)
      const cached = await cache.getOrCreate('async', async () => {
        calls++
        return -1
      })
      expect(cached).toBe(777)
      expect(calls).toBe(1)
    })

    it('passes the original input to func', async () => {
      const { cache } = createCache<{ id: number; name: string }, string>()
      const input = { id: 7, name: 'test' }
      let received: any = null
      const result = await cache.getOrCreate(input, receivedInput => {
        received = receivedInput
        return 'done'
      })
      expect(result).toBe('done')
      expect(received).toBe(input)
    })

    it('writes value file to disk with serialized content', async () => {
      const { cache, dir } = createCache<string, { value: number }>()
      await cache.getOrCreate('fs-check', () => ({ value: 123 }))
      const entries = await fs.promises.readdir(dir, {
        recursive: true,
        withFileTypes: true,
      })
      const files = entries.filter(entry => entry.isFile())
      const valueFile = files.find(entry => entry.name.endsWith('.value'))
      const statFile = files.find(entry => entry.name.endsWith('.stat'))
      expect(valueFile).toBeDefined()
      expect(statFile).toBeDefined()
      const valuePath = path.join(
        valueFile!.parentPath ?? valueFile!.path,
        valueFile!.name,
      )
      const valueData = await fs.promises.readFile(valuePath, 'utf8')
      expect(JSON.parse(valueData)).toEqual({ value: 123 })
    })

    it('produces a stat file with dateModified and dateUsed timestamps', async () => {
      const { cache, dir } = createCache<string, number>()
      const before = Date.now()
      await cache.getOrCreate('stat-check', () => 5)
      const after = Date.now()
      const entries = await fs.promises.readdir(dir, {
        recursive: true,
        withFileTypes: true,
      })
      const statFile = entries.find(
        entry => entry.isFile() && entry.name.endsWith('.stat'),
      )
      expect(statFile).toBeDefined()
      const statPath = path.join(
        statFile!.parentPath ?? statFile!.path,
        statFile!.name,
      )
      const stat = JSON.parse(
        await fs.promises.readFile(statPath, 'utf8'),
      ) as CacheStat
      expect(stat.dateModified).toBeGreaterThanOrEqual(before)
      expect(stat.dateModified).toBeLessThanOrEqual(after)
      expect(stat.dateUsed).toBeGreaterThanOrEqual(before)
      expect(stat.dateUsed).toBeLessThanOrEqual(after)
      expect(stat.hasError).toBeUndefined()
    })

    it('updates dateUsed on cache hit while preserving dateModified', async () => {
      const { cache, dir } = createCache<string, number>()
      await cache.getOrCreate('key', () => 10)
      const entries = await fs.promises.readdir(dir, {
        recursive: true,
        withFileTypes: true,
      })
      const statFile = entries.find(
        entry => entry.isFile() && entry.name.endsWith('.stat'),
      )
      expect(statFile).toBeDefined()
      const statPath = path.join(
        statFile!.parentPath ?? statFile!.path,
        statFile!.name,
      )
      const firstStat = JSON.parse(
        await fs.promises.readFile(statPath, 'utf8'),
      ) as CacheStat
      await delay(20)
      await cache.getOrCreate('key', () => 999)
      const secondStat = JSON.parse(
        await fs.promises.readFile(statPath, 'utf8'),
      ) as CacheStat
      expect(secondStat.dateModified).toBe(firstStat.dateModified)
      expect(secondStat.dateUsed).toBeGreaterThanOrEqual(firstStat.dateUsed)
    })
  })

  describe('error caching', () => {
    it('throws the error produced by func and caches it', async () => {
      const { cache } = createCache<string, number>()
      let calls = 0
      await expect(
        cache.getOrCreate('err-key', () => {
          calls++
          throw new Error('boom')
        }),
      ).rejects.toThrow()
      expect(calls).toBe(1)
      let secondCalls = 0
      await expect(
        cache.getOrCreate('err-key', () => {
          secondCalls++
          return 1
        }),
      ).rejects.toBeDefined()
      expect(secondCalls).toBe(0)
    })

    it('caches errors as formatted strings', async () => {
      const { cache } = createCache<string, number>()
      await expect(
        cache.getOrCreate('fmt-err', () => {
          throw new Error('original error message')
        }),
      ).rejects.toBeDefined()
      let thrown: unknown = null
      try {
        await cache.getOrCreate('fmt-err', () => 1)
      } catch (err) {
        thrown = err
      }
      expect(typeof thrown).toBe('string')
      expect(thrown as string).toContain('original error message')
    })

    it('does not keep a value file after func throws', async () => {
      const { cache, dir } = createCache<string, number>()
      await expect(
        cache.getOrCreate('only-err', () => {
          throw new Error('x')
        }),
      ).rejects.toBeDefined()
      const entries = await fs.promises.readdir(dir, {
        recursive: true,
        withFileTypes: true,
      })
      const files = entries.filter(entry => entry.isFile())
      expect(files.some(entry => entry.name.endsWith('.value'))).toBe(false)
      expect(files.some(entry => entry.name.endsWith('.error'))).toBe(true)
      expect(files.some(entry => entry.name.endsWith('.stat'))).toBe(true)
    })

    it('stat file marks hasError: true after error', async () => {
      const { cache, dir } = createCache<string, number>()
      await expect(
        cache.getOrCreate('err-stat', () => {
          throw new Error('err-text')
        }),
      ).rejects.toBeDefined()
      const entries = await fs.promises.readdir(dir, {
        recursive: true,
        withFileTypes: true,
      })
      const statFile = entries.find(
        entry => entry.isFile() && entry.name.endsWith('.stat'),
      )
      expect(statFile).toBeDefined()
      const statPath = path.join(
        statFile!.parentPath ?? statFile!.path,
        statFile!.name,
      )
      const stat = JSON.parse(
        await fs.promises.readFile(statPath, 'utf8'),
      ) as CacheStat
      expect(stat.hasError).toBe(true)
      expect(typeof stat.dateModified).toBe('number')
      expect(typeof stat.dateUsed).toBe('number')
    })

    it('updates dateUsed on subsequent reads of cached error while preserving dateModified', async () => {
      const { cache, dir } = createCache<string, number>()
      await expect(
        cache.getOrCreate('err-reuse', () => {
          throw new Error('err')
        }),
      ).rejects.toBeDefined()
      const entries = await fs.promises.readdir(dir, {
        recursive: true,
        withFileTypes: true,
      })
      const statFile = entries.find(
        entry => entry.isFile() && entry.name.endsWith('.stat'),
      )
      const statPath = path.join(
        statFile!.parentPath ?? statFile!.path,
        statFile!.name,
      )
      const firstStat = JSON.parse(
        await fs.promises.readFile(statPath, 'utf8'),
      ) as CacheStat
      await delay(20)
      await expect(
        cache.getOrCreate('err-reuse', () => 1),
      ).rejects.toBeDefined()
      const secondStat = JSON.parse(
        await fs.promises.readFile(statPath, 'utf8'),
      ) as CacheStat
      expect(secondStat.dateModified).toBe(firstStat.dateModified)
      expect(secondStat.dateUsed).toBeGreaterThanOrEqual(firstStat.dateUsed)
      expect(secondStat.hasError).toBe(true)
    })

    it('replaces a cached value with an error when func switches from success to failure after expiration', async () => {
      let expired = false
      const { cache, dir } = createCache<string, number>({
        isExpired: () => expired,
      })
      await cache.getOrCreate('switch', () => 10)
      expired = true
      await expect(
        cache.getOrCreate('switch', () => {
          throw new Error('now-error')
        }),
      ).rejects.toBeDefined()
      const entries = await fs.promises.readdir(dir, {
        recursive: true,
        withFileTypes: true,
      })
      const files = entries.filter(entry => entry.isFile())
      expect(files.some(entry => entry.name.endsWith('.value'))).toBe(false)
      expect(files.some(entry => entry.name.endsWith('.error'))).toBe(true)
    })

    it('replaces a cached error with a value when func switches from failure to success after expiration', async () => {
      let expired = false
      const { cache, dir } = createCache<string, number>({
        isExpired: () => expired,
      })
      await expect(
        cache.getOrCreate('switch-back', () => {
          throw new Error('err')
        }),
      ).rejects.toBeDefined()
      expired = true
      const ok = await cache.getOrCreate('switch-back', () => 777)
      expect(ok).toBe(777)
      const entries = await fs.promises.readdir(dir, {
        recursive: true,
        withFileTypes: true,
      })
      const files = entries.filter(entry => entry.isFile())
      expect(files.some(entry => entry.name.endsWith('.value'))).toBe(true)
      expect(files.some(entry => entry.name.endsWith('.error'))).toBe(false)
    })

    it('rethrows the exact error instance from func on the call that created it', async () => {
      const { cache } = createCache<string, number>()
      const original = new Error('unique-message')
      let thrown: unknown = null
      try {
        await cache.getOrCreate('exact', () => {
          throw original
        })
      } catch (err) {
        thrown = err
      }
      expect(thrown).toBe(original)
    })
  })

  describe('isExpired', () => {
    it('keeps cached entries fresh when isExpired is not provided', async () => {
      const { cache } = createCache<string, number>()
      await cache.getOrCreate('x', () => 1)
      let calls = 0
      const result = await cache.getOrCreate('x', () => {
        calls++
        return 2
      })
      expect(result).toBe(1)
      expect(calls).toBe(0)
    })

    it('re-runs func when isExpired returns true', async () => {
      let expired = false
      const { cache } = createCache<string, number>({
        isExpired: () => expired,
      })
      await cache.getOrCreate('y', () => 1)
      expired = true
      const result = await cache.getOrCreate('y', () => 2)
      expect(result).toBe(2)
    })

    it('passes a CacheStat object with dateModified, dateUsed, hasError to isExpired', async () => {
      const before = Date.now()
      const stats: CacheStat[] = []
      const { cache } = createCache<string, number>({
        isExpired: stat => {
          stats.push(stat)
          return false
        },
      })
      await cache.getOrCreate('i', () => 1)
      await cache.getOrCreate('i', () => 2)
      expect(stats.length).toBe(1)
      const stat = stats[0]
      expect(typeof stat.dateModified).toBe('number')
      expect(typeof stat.dateUsed).toBe('number')
      expect(stat.dateModified).toBeGreaterThanOrEqual(before)
      expect(stat.hasError).toBeFalsy()
    })

    it('passes hasError: true in CacheStat when re-reading a cached error', async () => {
      const stats: CacheStat[] = []
      const { cache } = createCache<string, number>({
        isExpired: stat => {
          stats.push(stat)
          return false
        },
      })
      await expect(
        cache.getOrCreate('e', () => {
          throw new Error('x')
        }),
      ).rejects.toBeDefined()
      await expect(cache.getOrCreate('e', () => 1)).rejects.toBeDefined()
      expect(stats.length).toBe(1)
      expect(stats[0].hasError).toBe(true)
    })

    it('uses age-based expiration correctly', async () => {
      const maxAgeMs = 50
      const { cache } = createCache<string, number>({
        isExpired: stat => Date.now() - stat.dateModified > maxAgeMs,
      })
      let calls = 0
      const first = await cache.getOrCreate('age', () => {
        calls++
        return 1
      })
      const second = await cache.getOrCreate('age', () => {
        calls++
        return 2
      })
      expect(first).toBe(1)
      expect(second).toBe(1)
      expect(calls).toBe(1)
      await delay(maxAgeMs + 30)
      const third = await cache.getOrCreate('age', () => {
        calls++
        return 3
      })
      expect(third).toBe(3)
      expect(calls).toBe(2)
    })

    it('does not call func when isExpired returns false and value exists', async () => {
      const { cache } = createCache<string, number>({
        isExpired: () => false,
      })
      await cache.getOrCreate('stable', () => 1)
      let calls = 0
      const result = await cache.getOrCreate('stable', () => {
        calls++
        return 99
      })
      expect(result).toBe(1)
      expect(calls).toBe(0)
    })

    it('deletes all three storages when isExpired returns true', async () => {
      let expired = false
      const { cache, dir } = createCache<string, number>({
        isExpired: () => expired,
      })
      await cache.getOrCreate('p', () => 1)
      expired = true
      await cache.getOrCreate('p', () => 2)
      const entries = await fs.promises.readdir(dir, {
        recursive: true,
        withFileTypes: true,
      })
      const files = entries.filter(entry => entry.isFile())
      expect(files.filter(entry => entry.name.endsWith('.value')).length).toBe(
        1,
      )
      expect(files.filter(entry => entry.name.endsWith('.error')).length).toBe(
        0,
      )
      expect(files.filter(entry => entry.name.endsWith('.stat')).length).toBe(1)
    })
  })

  describe('delete', () => {
    it('removes cached value so next getOrCreate re-runs func', async () => {
      const { cache } = createCache<string, number>()
      await cache.getOrCreate('d', () => 1)
      await cache.delete('d')
      let calls = 0
      const result = await cache.getOrCreate('d', () => {
        calls++
        return 2
      })
      expect(result).toBe(2)
      expect(calls).toBe(1)
    })

    it('removes cached error so next getOrCreate re-runs func', async () => {
      const { cache } = createCache<string, number>()
      await expect(
        cache.getOrCreate('de', () => {
          throw new Error('x')
        }),
      ).rejects.toBeDefined()
      await cache.delete('de')
      const result = await cache.getOrCreate('de', () => 42)
      expect(result).toBe(42)
    })

    it('removes all three files for the key from disk', async () => {
      const { cache, dir } = createCache<string, number>()
      await cache.getOrCreate('del-fs', () => 1)
      await cache.delete('del-fs')
      const entries = await fs.promises.readdir(dir, {
        recursive: true,
        withFileTypes: true,
      })
      const files = entries.filter(entry => entry.isFile())
      expect(files.length).toBe(0)
    })

    it('is a no-op for a non-existent key', async () => {
      const { cache } = createCache<string, number>()
      await cache.delete('missing')
      const result = await cache.getOrCreate('missing', () => 11)
      expect(result).toBe(11)
    })

    it('leaves other keys untouched', async () => {
      const { cache } = createCache<string, number>()
      await cache.getOrCreate('a', () => 1)
      await cache.getOrCreate('b', () => 2)
      await cache.delete('a')
      let calls = 0
      const aResult = await cache.getOrCreate('a', () => {
        calls++
        return 10
      })
      const bResult = await cache.getOrCreate('b', () => {
        calls++
        return 20
      })
      expect(aResult).toBe(10)
      expect(bResult).toBe(2)
      expect(calls).toBe(1)
    })
  })

  describe('clear', () => {
    it('removes all cached values', async () => {
      const { cache } = createCache<string, number>()
      await cache.getOrCreate('a', () => 1)
      await cache.getOrCreate('b', () => 2)
      await cache.getOrCreate('c', () => 3)
      await cache.clear()
      let calls = 0
      const a = await cache.getOrCreate('a', () => {
        calls++
        return 10
      })
      const b = await cache.getOrCreate('b', () => {
        calls++
        return 20
      })
      const c = await cache.getOrCreate('c', () => {
        calls++
        return 30
      })
      expect([a, b, c]).toEqual([10, 20, 30])
      expect(calls).toBe(3)
    })

    it('removes cached errors', async () => {
      const { cache } = createCache<string, number>()
      await expect(
        cache.getOrCreate('e', () => {
          throw new Error('x')
        }),
      ).rejects.toBeDefined()
      await cache.clear()
      const result = await cache.getOrCreate('e', () => 99)
      expect(result).toBe(99)
    })

    it('is idempotent when called on an empty cache', async () => {
      const { cache } = createCache<string, number>()
      await cache.clear()
      await cache.clear()
      const result = await cache.getOrCreate('x', () => 1)
      expect(result).toBe(1)
    })

    it('removes all files from disk', async () => {
      const { cache, dir } = createCache<string, number>()
      await cache.getOrCreate('k1', () => 1)
      await cache.getOrCreate('k2', () => 2)
      await expect(
        cache.getOrCreate('k3', () => {
          throw new Error('x')
        }),
      ).rejects.toBeDefined()
      await cache.clear()
      const entries = await fs.promises.readdir(dir, {
        recursive: true,
        withFileTypes: true,
      })
      const files = entries.filter(entry => entry.isFile())
      expect(files.length).toBe(0)
    })

    it('handles a mix of value-cached and error-cached entries', async () => {
      const { cache } = createCache<string, number>()
      await cache.getOrCreate('ok1', () => 1)
      await expect(
        cache.getOrCreate('err1', () => {
          throw new Error('x')
        }),
      ).rejects.toBeDefined()
      await cache.getOrCreate('ok2', () => 2)
      await expect(
        cache.getOrCreate('err2', () => {
          throw new Error('y')
        }),
      ).rejects.toBeDefined()
      await cache.clear()
      let calls = 0
      const ok1 = await cache.getOrCreate('ok1', () => {
        calls++
        return 100
      })
      const ok2 = await cache.getOrCreate('ok2', () => {
        calls++
        return 200
      })
      const err1 = await cache.getOrCreate('err1', () => {
        calls++
        return 300
      })
      const err2 = await cache.getOrCreate('err2', () => {
        calls++
        return 400
      })
      expect([ok1, ok2, err1, err2]).toEqual([100, 200, 300, 400])
      expect(calls).toBe(4)
    })
  })

  describe('concurrency', () => {
    it('runs func exactly once for parallel calls with the same input', async () => {
      const { cache } = createCache<string, number>()
      let calls = 0
      const results = await Promise.all(
        Array.from({ length: 20 }, () =>
          cache.getOrCreate('same', async () => {
            calls++
            await delay(15)
            return 42
          }),
        ),
      )
      expect(calls).toBe(1)
      results.forEach(result => expect(result).toBe(42))
    })

    it('runs func once per distinct input in parallel', async () => {
      const { cache } = createCache<string, number>()
      const inputs = Array.from({ length: 10 }, (_, i) => `key-${i}`)
      const calls: Record<string, number> = {}
      const results = await Promise.all(
        inputs.map(input =>
          cache.getOrCreate(input, async () => {
            calls[input] = (calls[input] ?? 0) + 1
            await delay(5)
            return parseInt(input.substring(4), 10) * 10
          }),
        ),
      )
      results.forEach((result, i) => expect(result).toBe(i * 10))
      inputs.forEach(input => expect(calls[input]).toBe(1))
    })

    it('serializes calls on the same key: a delete between two getOrCreate forces re-execution', async () => {
      const { cache } = createCache<string, number>()
      let calls = 0
      const first = cache.getOrCreate('s', async () => {
        calls++
        await delay(20)
        return 1
      })
      const second = cache.delete('s').then(() =>
        cache.getOrCreate('s', async () => {
          calls++
          await delay(20)
          return 2
        }),
      )
      const [firstResult, secondResult] = await Promise.all([first, second])
      expect(firstResult).toBe(1)
      expect(secondResult).toBe(2)
      expect(calls).toBe(2)
    })

    it('handles errors thrown by concurrent calls on the same key', async () => {
      const { cache } = createCache<string, number>()
      let calls = 0
      const promises = Array.from({ length: 10 }, () =>
        cache
          .getOrCreate('ec', async () => {
            calls++
            await delay(10)
            throw new Error('parallel')
          })
          .catch(err => err),
      )
      const results = await Promise.all(promises)
      expect(calls).toBe(1)
      results.forEach(result => expect(result).toBeDefined())
    })

    it('handles many concurrent distinct keys without interference', async () => {
      const { cache } = createCache<string, number>()
      const calls: Record<string, number> = {}
      const promises: Promise<number>[] = []
      for (let i = 0; i < 50; i++) {
        const key = `parallel-${i}`
        calls[key] = 0
        for (let repeat = 0; repeat < 3; repeat++) {
          promises.push(
            cache.getOrCreate(key, async () => {
              calls[key]++
              await delay(2)
              return i
            }),
          )
        }
      }
      const results = await Promise.all(promises)
      for (let i = 0; i < 50; i++) {
        for (let repeat = 0; repeat < 3; repeat++) {
          expect(results[i * 3 + repeat]).toBe(i)
        }
        expect(calls[`parallel-${i}`]).toBe(1)
      }
    })

    it('serializes delete and getOrCreate on the same key', async () => {
      const { cache } = createCache<string, number>()
      await cache.getOrCreate('sd', () => 100)
      let calls = 0
      const deletePromise = cache.delete('sd')
      const getPromise = cache.getOrCreate('sd', () => {
        calls++
        return 200
      })
      await Promise.all([deletePromise, getPromise])
      expect(calls).toBe(1)
      const result = await cache.getOrCreate('sd', () => 999)
      expect(result).toBe(200)
    })
  })

  describe('recovery from inconsistent disk state', () => {
    it('recreates value when only value file is missing but stat exists', async () => {
      const { cache, dir } = createCache<string, number>()
      await cache.getOrCreate('r1', () => 1)
      const entries = await fs.promises.readdir(dir, {
        recursive: true,
        withFileTypes: true,
      })
      const valueFile = entries.find(
        entry => entry.isFile() && entry.name.endsWith('.value'),
      )
      expect(valueFile).toBeDefined()
      const valuePath = path.join(
        valueFile!.parentPath ?? valueFile!.path,
        valueFile!.name,
      )
      await fs.promises.unlink(valuePath)
      let calls = 0
      const result = await cache.getOrCreate('r1', () => {
        calls++
        return 2
      })
      expect(result).toBe(2)
      expect(calls).toBe(1)
    })

    it('recreates value when stat file is missing but value exists', async () => {
      const { cache, dir } = createCache<string, number>()
      await cache.getOrCreate('r2', () => 1)
      const entries = await fs.promises.readdir(dir, {
        recursive: true,
        withFileTypes: true,
      })
      const statFile = entries.find(
        entry => entry.isFile() && entry.name.endsWith('.stat'),
      )
      expect(statFile).toBeDefined()
      const statPath = path.join(
        statFile!.parentPath ?? statFile!.path,
        statFile!.name,
      )
      await fs.promises.unlink(statPath)
      let calls = 0
      const result = await cache.getOrCreate('r2', () => {
        calls++
        return 2
      })
      expect(result).toBe(2)
      expect(calls).toBe(1)
    })
  })

  describe('custom converterInput', () => {
    it('uses a custom input→key converter when provided', async () => {
      const dirs = getDirs()
      const cache = new Cache<
        { id: number },
        number,
        any,
        string,
        Uint8Array,
        Uint8Array,
        Uint8Array
      >(
        createFileCacheOptions<{ id: number }, number>({
          dir: dirs.dir,
          tmpDir: dirs.tmpDir,
          converterInput: input => `id-${input.id}`,
        }),
      )
      await cache.getOrCreate({ id: 1 }, () => 10)
      let calls = 0
      const cached = await cache.getOrCreate({ id: 1 }, () => {
        calls++
        return 20
      })
      expect(cached).toBe(10)
      expect(calls).toBe(0)
      const fresh = await cache.getOrCreate({ id: 2 }, () => 30)
      expect(fresh).toBe(30)
    })

    it('treats inputs as the same key when converterInput maps them to the same string', async () => {
      const dirs = getDirs()
      const cache = new Cache<
        string,
        number,
        any,
        string,
        Uint8Array,
        Uint8Array,
        Uint8Array
      >(
        createFileCacheOptions<string, number>({
          dir: dirs.dir,
          tmpDir: dirs.tmpDir,
          converterInput: input => input.toLowerCase(),
        }),
      )
      await cache.getOrCreate('ABC', () => 7)
      const cached = await cache.getOrCreate('abc', () => 99)
      expect(cached).toBe(7)
    })
  })

  describe('custom converterValue', () => {
    it('uses a custom value converter for storage', async () => {
      const dirs = getDirs()
      const cache = new Cache<
        string,
        string,
        any,
        string,
        Uint8Array,
        Uint8Array,
        Uint8Array
      >(
        createFileCacheOptions<string, string>({
          dir: dirs.dir,
          tmpDir: dirs.tmpDir,
          converterValue: {
            to: (value: string) => new TextEncoder().encode(`#${value}#`),
            from: (data: Uint8Array) => {
              const text = new TextDecoder().decode(data)
              return text.slice(1, -1)
            },
          },
        }),
      )
      await cache.getOrCreate('k', () => 'hello')
      const cached = await cache.getOrCreate('k', () => 'world')
      expect(cached).toBe('hello')
      const entries = await fs.promises.readdir(dirs.dir, {
        recursive: true,
        withFileTypes: true,
      })
      const valueFile = entries.find(
        entry => entry.isFile() && entry.name.endsWith('.value'),
      )
      expect(valueFile).toBeDefined()
      const valuePath = path.join(
        valueFile!.parentPath ?? valueFile!.path,
        valueFile!.name,
      )
      const raw = await fs.promises.readFile(valuePath, 'utf8')
      expect(raw).toBe('#hello#')
    })
  })

  describe('edge case inputs and values', () => {
    it('handles unicode string inputs and values', async () => {
      const { cache } = createCache<string, string>()
      const result = await cache.getOrCreate(
        'ключ-🔑-日本',
        () => 'значение-🎉-中文',
      )
      expect(result).toBe('значение-🎉-中文')
      const cached = await cache.getOrCreate('ключ-🔑-日本', () => 'other')
      expect(cached).toBe('значение-🎉-中文')
    })

    it('stores and retrieves a large value', async () => {
      const { cache } = createCache<string, string>()
      const large = 'x'.repeat(500_000)
      const result = await cache.getOrCreate('big', () => large)
      expect(result.length).toBe(large.length)
      const cached = await cache.getOrCreate('big', () => 'small')
      expect(cached.length).toBe(large.length)
    })

    it('treats undefined input the same across calls', async () => {
      const { cache } = createCache<any, number>()
      await cache.getOrCreate(undefined, () => 1)
      let calls = 0
      const result = await cache.getOrCreate(undefined, () => {
        calls++
        return 2
      })
      expect(result).toBe(1)
      expect(calls).toBe(0)
    })

    it('treats null and undefined inputs as the same key', async () => {
      const { cache } = createCache<any, number>()
      await cache.getOrCreate(null, () => 1)
      let calls = 0
      const result = await cache.getOrCreate(undefined, () => {
        calls++
        return 2
      })
      expect(result).toBe(1)
      expect(calls).toBe(0)
    })

    it('distinguishes object inputs with different serializations', async () => {
      const { cache } = createCache<any, string>()
      const first = await cache.getOrCreate({ a: 1 }, () => 'first')
      const second = await cache.getOrCreate({ a: 2 }, () => 'second')
      const firstAgain = await cache.getOrCreate({ a: 1 }, () => 'other')
      expect(first).toBe('first')
      expect(second).toBe('second')
      expect(firstAgain).toBe('first')
    })

    it('stores JSON null as a value', async () => {
      const { cache } = createCache<string, any>()
      const result = await cache.getOrCreate('nullish', () => null)
      expect(result).toBeNull()
      let calls = 0
      const cached = await cache.getOrCreate('nullish', () => {
        calls++
        return 'anything'
      })
      expect(cached).toBeNull()
      expect(calls).toBe(0)
    })

    it('shares a single tmp directory across multiple cache instances', async () => {
      const sharedTmp = path.join(DIR_TMP, `shared-${++runCounter}`)
      const dir1 = path.join(DIR_TMP, `a-${runCounter}`)
      const dir2 = path.join(DIR_TMP, `b-${runCounter}`)
      const cacheA = new Cache<
        string,
        number,
        any,
        string,
        Uint8Array,
        Uint8Array,
        Uint8Array
      >(
        createFileCacheOptions<string, number>({
          dir: dir1,
          tmpDir: sharedTmp,
        }),
      )
      const cacheB = new Cache<
        string,
        number,
        any,
        string,
        Uint8Array,
        Uint8Array,
        Uint8Array
      >(
        createFileCacheOptions<string, number>({
          dir: dir2,
          tmpDir: sharedTmp,
        }),
      )
      const [resultA, resultB] = await Promise.all([
        cacheA.getOrCreate('k', () => 1),
        cacheB.getOrCreate('k', () => 2),
      ])
      expect(resultA).toBe(1)
      expect(resultB).toBe(2)
      const cachedA = await cacheA.getOrCreate('k', () => 999)
      const cachedB = await cacheB.getOrCreate('k', () => 999)
      expect(cachedA).toBe(1)
      expect(cachedB).toBe(2)
    })
  })

  describe('heavy load', () => {
    it('handles many sequential writes and reads', async () => {
      const { cache } = createCache<string, number>()
      const count = 100
      for (let i = 0; i < count; i++) {
        const result = await cache.getOrCreate(`seq-${i}`, () => i * 2)
        expect(result).toBe(i * 2)
      }
      let calls = 0
      for (let i = 0; i < count; i++) {
        const result = await cache.getOrCreate(`seq-${i}`, () => {
          calls++
          return -1
        })
        expect(result).toBe(i * 2)
      }
      expect(calls).toBe(0)
    })

    it('handles many parallel writes and reads on distinct keys', async () => {
      const { cache } = createCache<string, number>()
      const count = 100
      const writes = Array.from({ length: count }, (_, i) =>
        cache.getOrCreate(`par-${i}`, async () => {
          await delay(1)
          return i
        }),
      )
      const results = await Promise.all(writes)
      results.forEach((value, i) => expect(value).toBe(i))
      let calls = 0
      const reads = Array.from({ length: count }, (_, i) =>
        cache.getOrCreate(`par-${i}`, () => {
          calls++
          return -1
        }),
      )
      const cached = await Promise.all(reads)
      cached.forEach((value, i) => expect(value).toBe(i))
      expect(calls).toBe(0)
    })

    it('maintains consistency under mixed parallel getOrCreate, delete, and clear calls', async () => {
      const { cache } = createCache<string, number>()
      await cache.getOrCreate('a', () => 1)
      await cache.getOrCreate('b', () => 2)
      await cache.getOrCreate('c', () => 3)
      await Promise.all([
        cache.delete('a'),
        cache.getOrCreate('d', () => 4),
        cache.getOrCreate('e', () => 5),
        cache.delete('b'),
      ])
      let aCalls = 0
      let bCalls = 0
      const [aResult, bResult, cResult, dResult, eResult] = await Promise.all([
        cache.getOrCreate('a', () => {
          aCalls++
          return 11
        }),
        cache.getOrCreate('b', () => {
          bCalls++
          return 22
        }),
        cache.getOrCreate('c', () => 999),
        cache.getOrCreate('d', () => 999),
        cache.getOrCreate('e', () => 999),
      ])
      expect(aResult).toBe(11)
      expect(bResult).toBe(22)
      expect(cResult).toBe(3)
      expect(dResult).toBe(4)
      expect(eResult).toBe(5)
      expect(aCalls).toBe(1)
      expect(bCalls).toBe(1)
      await cache.clear()
      let afterClearCalls = 0
      const result = await cache.getOrCreate('a', () => {
        afterClearCalls++
        return 100
      })
      expect(result).toBe(100)
      expect(afterClearCalls).toBe(1)
    })
  })
})
