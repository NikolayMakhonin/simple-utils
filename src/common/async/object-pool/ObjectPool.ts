import { type IAbortSignalFast } from '@flemist/abort-controller-fast'
import type {
  PromiseLikeOrValue,
  PromiseOrValue,
} from 'src/common/types/common'
import { type IStackPool, StackPool } from './StackPool'
import { type IPool, Pool, poolWait } from 'src/common/async/pool/Pool'
import { Pools } from 'src/common/async/pool/Pools'
import { isPromiseLike } from 'src/common/async/promise/isPromiseLike'
import { type Priority } from 'src/common/async/priority/Priority'

export interface IObjectPool<TObject extends object> {
  readonly pool: IPool

  readonly availableObjects: ReadonlyArray<TObject>
  readonly heldObjects: ReadonlySet<TObject> | null

  /** Like getWait, but takes the available objects at once and holds no slots for them */
  get(count: number): TObject[]

  /**
   * Gives the objects of the range back to the pool with a slot for each of them.
   * The pool takes back at most as many as keep availableObjects within heldCountMax
   * and as it holds slots, and returns how many it took back.
   * The caller keeps the rest of the objects and their slots,
   * and heldObjects stops tracking all objects of the range
   */
  release(
    objects: TObject[],
    start?: null | number,
    end?: null | number,
  ): PromiseOrValue<number>

  /** Resolves when pool releases at least one held slot */
  tick(abortSignal?: null | IAbortSignalFast): PromiseOrValue<void>

  /**
   * Waits until the pool can hold count and holds it, then takes up to count available objects:
   * fewer when fewer are available, and the caller creates the rest
   */
  getWait(
    count: number,
    priority?: null | Priority,
    abortSignal?: null | IAbortSignalFast,
  ): Promise<TObject[]>

  /**
   * Holds count slots and calls func with count objects, the available ones and created ones
   * for the rest. When func settles, gives the objects back with their slots, and destroys
   * the ones that the pool does not take back, whose slots stay held until they are destroyed.
   * Returns the result of func without waiting until the objects are back
   */
  use<TResult>(
    count: number,
    func: (
      objects: ReadonlyArray<TObject>,
      abortSignal?: null | IAbortSignalFast,
    ) => PromiseLikeOrValue<TResult>,
    priority?: null | Priority,
    abortSignal?: null | IAbortSignalFast,
  ): Promise<TResult>

  /**
   * Creates objects in advance, at most size of them, until every slot that is not held
   * through this object pool has an available object, and returns how many it created
   */
  allocate(size?: null | number): PromiseOrValue<number>

  /**
   * Waits until no object of this pool is in use, being created, or being destroyed,
   * then destroys the available objects and removes them from the pool.
   * Calls that start while it waits delay it.
   * When the destroy of an object fails, clear still destroys the other objects, and then
   * rejects with that error, or with an AggregateError of the errors when several destroys fail
   */
  clear(): Promise<void>
}

export type ObjectPoolArgs<TObject extends object> = {
  pool: IPool
  /** Custom storage for available objects */
  availableObjects?: null | IStackPool<TObject>
  /** Enables tracking of objects currently held and not yet released */
  heldObjects?: null | boolean | Set<TObject>
  create: () => PromiseLikeOrValue<TObject>
  /**
   * Destroys an object that the pool gives up: one that use gives back
   * and the pool does not take back, and each available object that clear removes
   */
  destroy?: null | ((obj: TObject) => PromiseLikeOrValue<void>)
}

export class ObjectPool<TObject extends object>
  implements IObjectPool<TObject>
{
  private readonly _pool: IPool
  /**
   * Part of _pool, so it holds every slot held through _pool,
   * and also a slot for each object that allocate is creating or clear is destroying.
   * Each slot must be released exclusively after its object, if any, is stored or destroyed,
   * because the method clear waits until no slot is held,
   * and then destroys the available objects
   */
  private readonly _ownPool: Pool
  private readonly _availableObjects: IStackPool<TObject>
  private readonly _heldObjects: Set<TObject> | null
  private readonly _create: () => PromiseLikeOrValue<TObject>
  private readonly _destroy?:
    | null
    | ((obj: TObject) => PromiseLikeOrValue<void>)

  constructor({
    pool,
    availableObjects,
    heldObjects,
    destroy,
    create,
  }: ObjectPoolArgs<TObject>) {
    this._ownPool = new Pool(pool.heldCountMax)
    this._pool = new Pools(pool, this._ownPool)
    this._availableObjects = availableObjects ?? new StackPool()
    this._heldObjects =
      heldObjects === true ? new Set<TObject>() : heldObjects || null
    this._create = create
    this._destroy = destroy
  }

  get pool() {
    return this._pool
  }

  get availableObjects(): ReadonlyArray<TObject> {
    return this._availableObjects.objects
  }

  /** Objects currently held and not yet released */
  get heldObjects(): ReadonlySet<TObject> | null {
    return this._heldObjects
  }

  get(count: number): TObject[] {
    const objects = this._availableObjects.get(count)
    if (this._heldObjects) {
      for (let i = 0, len = objects.length; i < len; i++) {
        this._heldObjects.add(objects[i])
      }
    }
    return objects
  }

  release(
    objects: TObject[],
    start?: null | number,
    end?: null | number,
  ): PromiseOrValue<number> {
    if (start == null) {
      start = 0
    }
    if (end == null) {
      end = objects.length
    }
    if (this._heldObjects) {
      for (let i = start; i < end; i++) {
        const obj = objects[i]
        if (obj != null) {
          this._heldObjects.delete(obj)
        }
      }
    }
    // An empty pool lets one call hold more slots than heldCountMax.
    // Without such a call, no more than heldCountMax objects are ever in use at once.
    // The pool takes back at most as many objects as keep availableObjects within heldCountMax.
    // The limit is not holdAvailable, because a call holds its slots before it takes objects.
    // A limit by holdAvailable between these two steps would refuse objects that later calls need
    const keepCountMax =
      this._ownPool.heldCountMax - this._availableObjects.size
    if (end - start > keepCountMax) {
      end = start + Math.max(keepCountMax, 0)
    }
    // Each object comes back with its slot,
    // so the pool takes back at most as many objects as it holds slots
    const releaseCount = Math.min(end - start, this._pool.releaseAvailable)
    // The release of _pool frees the slots of _ownPool at once,
    // also when the pool of ObjectPoolArgs returns its slots later.
    // The method clear destroys the available objects as soon as _ownPool holds no slot,
    // so the objects are stored before the release
    this._availableObjects.release(
      objects,
      start,
      Math.min(objects.length, start + releaseCount),
    )
    return this._pool.release(releaseCount, true)
  }

  tick(abortSignal?: null | IAbortSignalFast): PromiseOrValue<void> {
    return this._pool.tick(abortSignal)
  }

  async getWait(
    count: number,
    priority?: null | Priority,
    abortSignal?: null | IAbortSignalFast,
  ): Promise<TObject[]> {
    await poolWait({
      pool: this._pool,
      count,
      hold: true,
      priority,
      abortSignal,
    })
    return this.get(count)
  }

  async use<TResult>(
    count: number,
    func: (
      objects: ReadonlyArray<TObject>,
      abortSignal?: null | IAbortSignalFast,
    ) => PromiseLikeOrValue<TResult>,
    priority?: null | Priority,
    abortSignal?: null | IAbortSignalFast,
  ): Promise<TResult> {
    const objects = await this.getWait(count, priority, abortSignal)

    try {
      await this._createObjects(objects, count)
      return await func(objects, abortSignal)
    } finally {
      void this._releaseAndDestroy(objects, count)
    }
  }

  private async _createObjects(
    objects: TObject[],
    count: number,
  ): Promise<void> {
    for (let i = objects.length; i < count; i++) {
      const obj = await this._create()
      if (obj == null) {
        throw new Error('[ObjectPool][use] create returned null or undefined')
      }
      if (this._heldObjects) {
        this._heldObjects.add(obj)
      }
      objects.push(obj)
    }
  }

  private async _releaseAndDestroy(
    objects: TObject[],
    count: number,
  ): Promise<void> {
    const releasedCount = await this.release(objects)
    const unreleased = count - releasedCount
    if (unreleased > 0) {
      // The remaining slots are released after the objects that release did not take back
      // are destroyed, so that _pool counts these objects until then.
      // The method clear waits for the slots of _ownPool, so it waits for these destroys too
      try {
        await this._destroyObjects(objects, releasedCount)
      } finally {
        await this._pool.release(unreleased, true)
      }
    }
  }

  private async _destroyObjects(
    objects: TObject[],
    start: number,
  ): Promise<void> {
    if (this._destroy) {
      // Each object is destroyed also when the destroy of another one throws,
      // because the pool no longer holds these objects, so nothing else destroys them
      let errors: unknown[] | null = null
      for (let i = start, len = objects.length; i < len; i++) {
        try {
          await this._destroy(objects[i])
        } catch (err) {
          if (!errors) {
            errors = [err]
          } else {
            errors.push(err)
          }
        }
      }
      if (errors) {
        if (errors.length === 1) {
          throw errors[0]
        }
        throw new AggregateError(
          errors,
          `[ObjectPool] destroy failed for ${errors.length} objects`,
        )
      }
    }
  }

  allocate(size?: null | number): PromiseOrValue<number> {
    let promises: Promise<void>[] | null = null
    let createCount = this._ownPool.holdAvailable - this._availableObjects.size
    if (size != null && size < createCount) {
      createCount = size
    }
    // Slots held without objects, such as those of use before it takes its objects,
    // can leave more available objects than slots left to hold
    if (createCount <= 0) {
      return 0
    }

    for (let i = 0; i < createCount; i++) {
      const objectOrPromise = this._create()
      if (objectOrPromise == null) {
        throw new Error(
          '[ObjectPool][allocate] create returned null or undefined',
        )
      }
      if (isPromiseLike(objectOrPromise)) {
        const promise = this._releaseAllocatedWait(objectOrPromise)
        if (!promises) {
          promises = [promise]
        } else {
          promises.push(promise)
        }
      } else {
        this._availableObjects.release([objectOrPromise])
      }
    }
    if (promises) {
      return Promise.all(promises).then(() => createCount)
    }

    return createCount
  }

  private async _releaseAllocatedWait(
    objectPromise: PromiseLike<TObject>,
  ): Promise<void> {
    // Holds a slot while the object is created,
    // so that use waits for this object instead of creating its own for the slot
    if (!this._ownPool.hold(1)) {
      throw new Error(
        '[ObjectPool][allocate] hold failed after the check of holdAvailable',
      )
    }
    let obj: TObject
    try {
      obj = await objectPromise
      if (obj == null) {
        throw new Error(
          '[ObjectPool][allocate] create returned null or undefined',
        )
      }
    } catch (err) {
      this._ownPool.release(1)
      throw err
    }
    this._availableObjects.release([obj])
    this._ownPool.release(1)
  }

  async clear(): Promise<void> {
    while (this._ownPool.heldCount > 0) {
      await this._ownPool.tick()
    }
    const objects = this._availableObjects.get(this._availableObjects.size)
    // Holds a slot for each object while it is destroyed,
    // so that another clear waits for these destroys,
    // and calls that start meanwhile find these slots held
    if (!this._ownPool.hold(objects.length)) {
      throw new Error(
        '[ObjectPool][clear] hold failed on a pool that held no slot',
      )
    }
    try {
      await this._destroyObjects(objects, 0)
    } finally {
      this._ownPool.release(objects.length)
    }
  }
}
