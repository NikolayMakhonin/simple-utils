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

  get(count: number): TObject[]

  /** Returns the number of released objects; may release fewer than requested when pool capacity is exceeded */
  release(
    objects: TObject[],
    start?: null | number,
    end?: null | number,
  ): PromiseOrValue<number>

  /** Resolves when pool releases at least one held slot */
  tick(abortSignal?: null | IAbortSignalFast): PromiseOrValue<void>

  /** Waits until pool can hold the requested count, then gets objects */
  getWait(
    count: number,
    priority?: null | Priority,
    abortSignal?: null | IAbortSignalFast,
  ): Promise<TObject[]>

  use<TResult>(
    count: number,
    func: (
      objects: ReadonlyArray<TObject>,
      abortSignal?: null | IAbortSignalFast,
    ) => PromiseLikeOrValue<TResult>,
    priority?: null | Priority,
    abortSignal?: null | IAbortSignalFast,
  ): Promise<TResult>

  allocate(size?: null | number): PromiseOrValue<number>
}

export type ObjectPoolArgs<TObject extends object> = {
  pool: IPool
  /** Custom storage for available objects */
  availableObjects?: null | IStackPool<TObject>
  /** Enables tracking of objects currently held and not yet released */
  heldObjects?: null | boolean | Set<TObject>
  create: () => PromiseLikeOrValue<TObject>
  destroy?: null | ((obj: TObject) => PromiseLikeOrValue<void>)
}

export class ObjectPool<TObject extends object>
  implements IObjectPool<TObject>
{
  private readonly _pool: IPool
  private readonly _allocatePool: IPool
  private readonly _availableObjects: IStackPool<TObject>
  private readonly _heldObjects: Set<TObject> | null
  private readonly _create?: null | (() => PromiseLikeOrValue<TObject>)
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
    this._allocatePool = new Pool(pool.heldCountMax)
    this._pool = new Pools(pool, this._allocatePool)
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
    return this._release(objects, this._pool, start, end)
  }

  private _release(
    objects: TObject[],
    pool: IPool,
    start?: null | number,
    end?: null | number,
  ): PromiseOrValue<number> {
    if (start == null) {
      start = 0
    }
    if (end == null) {
      end = objects.length
    }
    const tryReleaseCount = end - start
    const released = pool.release(tryReleaseCount, true)
    if (isPromiseLike(released)) {
      return released.then(releasedCount => {
        return this._releaseObjects(objects, start, releasedCount)
      })
    }
    return this._releaseObjects(objects, start, released)
  }

  private _releaseObjects(
    objects: TObject[],
    start: number,
    releasedCount: number,
  ): number {
    const end = Math.min(objects.length, start + releasedCount)
    this._availableObjects.release(objects, start, end)

    if (this._heldObjects) {
      for (let i = start; i < end; i++) {
        const obj = objects[i]
        if (obj != null) {
          this._heldObjects.delete(obj)
        }
      }
    }

    return releasedCount
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
    if (!this._create) {
      throw new Error('[ObjectPool][use] create function is not specified')
    }
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
      const obj = await this._create!()
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
      await this._pool.release(unreleased, true)
    }
    if (this._destroy) {
      for (let i = releasedCount, len = objects.length; i < len; i++) {
        await this._destroy(objects[i])
      }
    }
  }

  allocate(size?: null | number): PromiseOrValue<number> {
    if (!this._create) {
      throw new Error('[ObjectPool][allocate] create function is not specified')
    }
    const promises: Promise<void>[] = []
    let tryHoldCount =
      this._allocatePool.holdAvailable - this._availableObjects.size
    if (size != null && size < tryHoldCount) {
      tryHoldCount = size
    }
    if (tryHoldCount < 0) {
      throw new Error(
        `[ObjectPool][allocate] tryHoldCount (${tryHoldCount}) < 0`,
      )
    }
    const heldCount = this._allocatePool.hold(tryHoldCount) ? tryHoldCount : 0

    let allocatedCount = 0
    const releasePromiseObject = async (
      objectPromise: PromiseLike<TObject>,
    ) => {
      let obj: TObject
      try {
        obj = await objectPromise
      } catch (err) {
        this._allocatePool.release(1)
        throw err
      }
      allocatedCount += await this._release([obj], this._allocatePool)
    }

    const releasePromise = async (promise: PromiseLike<number>) => {
      allocatedCount += await promise
    }

    for (let i = 0; i < heldCount; i++) {
      const objectOrPromise = this._create()
      if (isPromiseLike(objectOrPromise)) {
        promises.push(releasePromiseObject(objectOrPromise))
      } else {
        const countOrPromise = this._release(
          [objectOrPromise],
          this._allocatePool,
        )
        if (isPromiseLike(countOrPromise)) {
          promises.push(releasePromise(countOrPromise))
        } else {
          allocatedCount += countOrPromise
        }
      }
    }
    if (promises.length) {
      return Promise.all(promises).then(() => allocatedCount)
    }

    return allocatedCount
  }
}
