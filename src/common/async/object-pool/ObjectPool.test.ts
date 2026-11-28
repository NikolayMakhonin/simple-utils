import { describe, it, expect } from 'vitest'
import { Pool } from 'src/common/async/pool/Pool'
import { waitMicrotasks } from 'src/common/async/wait/waitMicrotasks'
import { ManualPromise } from 'src/common/async/promise/ManualPromise'
import { TimeLimitPool } from 'src/common/async/time-limit/TimeLimitPool'
import { ClockMock } from 'src/common/time/clock'
import { ObjectPool } from './ObjectPool'

describe('ObjectPool', () => {
  it('allocate returns 0 when availableObjects outnumber pool.holdAvailable', () => {
    let createCount = 0
    const objectPool = new ObjectPool<{ id: number }>({
      pool: new Pool(2),
      create: () => ({ id: ++createCount }),
    })
    expect(objectPool.allocate()).toBe(2)
    // A slot held through pool without an object leaves 2 available objects for 1 slot left to hold
    expect(objectPool.pool.hold(1)).toBe(true)
    expect(objectPool.allocate()).toBe(0)
    expect(createCount).toBe(2)
  })

  it('allocate leaves no slot held when create throws', () => {
    let createCount = 0
    const objectPool = new ObjectPool<{ id: number }>({
      pool: new Pool(3),
      create: () => {
        createCount++
        if (createCount === 2) {
          throw new Error('create failed')
        }
        return { id: createCount }
      },
    })
    expect(() => objectPool.allocate()).toThrow('create failed')
    expect(objectPool.availableObjects.map(o => o.id)).toEqual([1])
    expect(objectPool.pool.holdAvailable).toBe(3)
  })

  it('allocate throws when create returns null', () => {
    const objectPool = new ObjectPool<{ id: number }>({
      pool: new Pool(1),
      create: () => null as any,
    })
    expect(() => objectPool.allocate()).toThrow(
      '[ObjectPool][allocate] create returned null or undefined',
    )
    expect(objectPool.pool.holdAvailable).toBe(1)
  })

  it('use waits for an object that allocate creates instead of creating its own', async () => {
    let createCount = 0
    const created = new ManualPromise<{ id: number }>()
    const objectPool = new ObjectPool<{ id: number }>({
      pool: new Pool(1),
      create: () => {
        createCount++
        return created.promise
      },
    })
    const allocated = objectPool.allocate()
    let usedIds: number[] = []
    const used = objectPool.use(1, objects => {
      usedIds = objects.map(o => o.id)
    })
    // allocate holds the only slot while its object is created
    await waitMicrotasks()
    expect(createCount).toBe(1)
    created.resolve({ id: 1 })
    await allocated
    await used
    expect(usedIds).toEqual([1])
    expect(createCount).toBe(1)
  })

  it('use keeps at most heldCountMax available objects and destroys the others', async () => {
    let createCount = 0
    const destroyedIds: number[] = []
    const heldObjects = new Set<{ id: number }>()
    const objectPool = new ObjectPool<{ id: number }>({
      pool: new Pool(1),
      heldObjects,
      create: () => ({ id: ++createCount }),
      destroy: o => {
        destroyedIds.push(o.id)
      },
    })
    // An empty pool holds any count, so use creates 3 objects for a pool of 1
    await objectPool.use(3, () => {})
    // The release that use starts in its finally ends after use returns
    await waitMicrotasks()
    expect(objectPool.availableObjects.map(o => o.id)).toEqual([1])
    expect(destroyedIds).toEqual([2, 3])
    expect(heldObjects.size).toBe(0)
  })

  it('release stops tracking every object it gets, also the ones it does not take back', () => {
    let createCount = 0
    const heldObjects = new Set<{ id: number }>()
    const objectPool = new ObjectPool<{ id: number }>({
      pool: new Pool(2),
      heldObjects,
      create: () => ({ id: ++createCount }),
    })
    expect(objectPool.allocate()).toBe(2)
    expect(objectPool.pool.hold(2)).toBe(true)
    const objects = objectPool.get(2)
    // An object given back first leaves room for 1 of the 2 objects
    objectPool.release([{ id: 3 }])
    expect(objectPool.release(objects)).toBe(1)
    expect(heldObjects.size).toBe(0)
    expect(objectPool.availableObjects.map(o => o.id)).toEqual([3, 1])
  })

  it('clear destroys the available objects and removes them from the pool', async () => {
    let createCount = 0
    const destroyedIds: number[] = []
    const objectPool = new ObjectPool<{ id: number }>({
      pool: new Pool(2),
      create: () => ({ id: ++createCount }),
      destroy: o => {
        destroyedIds.push(o.id)
      },
    })
    expect(objectPool.allocate()).toBe(2)
    await objectPool.clear()
    expect(destroyedIds).toEqual([1, 2])
    expect(objectPool.availableObjects.length).toBe(0)
  })

  it('clear waits until the objects in use come back, then destroys them', async () => {
    let createCount = 0
    const destroyedIds: number[] = []
    const objectPool = new ObjectPool<{ id: number }>({
      pool: new Pool(1),
      create: () => ({ id: ++createCount }),
      destroy: o => {
        destroyedIds.push(o.id)
      },
    })
    const funcResult = new ManualPromise()
    const used = objectPool.use(1, () => funcResult.promise)
    await waitMicrotasks()
    let isCleared = false
    const cleared = objectPool.clear().then(() => {
      isCleared = true
    })
    await waitMicrotasks()
    expect(isCleared).toBe(false)
    funcResult.resolve()
    await used
    await cleared
    expect(destroyedIds).toEqual([1])
    expect(objectPool.availableObjects.length).toBe(0)
  })

  it('clear waits for an object that allocate creates, then destroys it', async () => {
    const created = new ManualPromise<{ id: number }>()
    const destroyedIds: number[] = []
    const objectPool = new ObjectPool<{ id: number }>({
      pool: new Pool(1),
      create: () => created.promise,
      destroy: o => {
        destroyedIds.push(o.id)
      },
    })
    const allocated = objectPool.allocate()
    let isCleared = false
    const cleared = objectPool.clear().then(() => {
      isCleared = true
    })
    await waitMicrotasks()
    expect(isCleared).toBe(false)
    created.resolve({ id: 1 })
    await allocated
    await cleared
    expect(destroyedIds).toEqual([1])
    expect(objectPool.availableObjects.length).toBe(0)
  })

  it('clear waits until use destroys the objects that the pool does not take back', async () => {
    let createCount = 0
    const destroyedIds: number[] = []
    const destroyed = new ManualPromise()
    const objectPool = new ObjectPool<{ id: number }>({
      pool: new Pool(1),
      create: () => ({ id: ++createCount }),
      destroy: o => {
        destroyedIds.push(o.id)
        return destroyed.promise
      },
    })
    // An empty pool holds any count, so use creates 3 objects for a pool of 1
    await objectPool.use(3, () => {})
    let isCleared = false
    const cleared = objectPool.clear().then(() => {
      isCleared = true
    })
    await waitMicrotasks()
    // The pool takes back 1 object, and the slots of the other 2 stay held while use destroys them
    expect(destroyedIds).toEqual([2])
    expect(objectPool.pool.holdAvailable).toBe(0)
    expect(isCleared).toBe(false)
    destroyed.resolve()
    await cleared
    expect(destroyedIds).toEqual([2, 3, 1])
    expect(objectPool.pool.holdAvailable).toBe(1)
  })

  it('clear waits for another clear that destroys objects', async () => {
    let createCount = 0
    const destroyed = new ManualPromise()
    const objectPool = new ObjectPool<{ id: number }>({
      pool: new Pool(1),
      create: () => ({ id: ++createCount }),
      destroy: () => destroyed.promise,
    })
    expect(objectPool.allocate()).toBe(1)
    const clearedFirst = objectPool.clear()
    let isClearedSecond = false
    const clearedSecond = objectPool.clear().then(() => {
      isClearedSecond = true
    })
    await waitMicrotasks()
    expect(isClearedSecond).toBe(false)
    destroyed.resolve()
    await clearedFirst
    await clearedSecond
  })

  it('clear destroys the other objects when destroy throws, and rejects with the error', async () => {
    let createCount = 0
    const destroyedIds: number[] = []
    const objectPool = new ObjectPool<{ id: number }>({
      pool: new Pool(3),
      create: () => ({ id: ++createCount }),
      destroy: o => {
        destroyedIds.push(o.id)
        if (o.id === 2) {
          throw new Error('destroy failed')
        }
      },
    })
    expect(objectPool.allocate()).toBe(3)
    await expect(objectPool.clear()).rejects.toThrow('destroy failed')
    expect(destroyedIds).toEqual([1, 2, 3])
    expect(objectPool.availableObjects.length).toBe(0)
    expect(objectPool.pool.holdAvailable).toBe(3)
  })

  it('clear rejects with an AggregateError of the errors when several destroys throw', async () => {
    let createCount = 0
    const objectPool = new ObjectPool<{ id: number }>({
      pool: new Pool(2),
      create: () => ({ id: ++createCount }),
      destroy: o => {
        throw new Error(`destroy failed ${o.id}`)
      },
    })
    expect(objectPool.allocate()).toBe(2)
    await expect(objectPool.clear()).rejects.toEqual(
      new AggregateError(
        [new Error('destroy failed 1'), new Error('destroy failed 2')],
        '[ObjectPool] destroy failed for 2 objects',
      ),
    )
  })

  it('use gives its objects back at once when the pool returns their slots later', async () => {
    let createCount = 0
    const destroyedIds: number[] = []
    const clock = new ClockMock()
    const objectPool = new ObjectPool<{ id: number }>({
      pool: new TimeLimitPool({ pool: new Pool(1), time: 1000, clock }),
      create: () => ({ id: ++createCount }),
      destroy: o => {
        destroyedIds.push(o.id)
      },
    })
    await objectPool.use(1, () => {})
    // The slot comes back 1000 ms after the release, the object at once
    expect(objectPool.availableObjects.map(o => o.id)).toEqual([1])
    expect(objectPool.pool.holdAvailable).toBe(0)
    expect(objectPool.allocate()).toBe(0)
    await objectPool.clear()
    expect(destroyedIds).toEqual([1])
    clock.time.addValue(1000)
    await waitMicrotasks()
    expect(objectPool.pool.holdAvailable).toBe(1)
    expect(objectPool.availableObjects.length).toBe(0)
  })
})
