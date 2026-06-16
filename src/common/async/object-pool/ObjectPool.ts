import { type IAbortSignalFast } from '@flemist/abort-controller-fast'
import { type IStackPool, StackPool } from './StackPool'
import { type IPool, Pool, poolWait } from 'src/common/async/pool/Pool'
import { Pools } from 'src/common/async/pool/Pools'
import { isPromiseLike } from 'src/common/async/promise/isPromiseLike'
import { type Priority } from 'src/common/async/priority/Priority'
import { type AwaitPriority } from 'src/common/async/priority-queue/helpers'

export interface IObjectPool<TObject extends object> {
  readonly pool: IPool

  readonly availableObjects: ReadonlyArray<TObject>
  readonly heldObjects?: null | ReadonlySet<TObject>

  get(count: number): TObject[]

  /** Returns the number of released objects; may release fewer than requested when pool capacity is exceeded */
  release(
    objects: TObject[],
    start?: null | number,
    end?: null | number,
  ): Promise<number> | number

  /** Resolves when pool releases at least one held slot */
  tick(abortSignal?: null | IAbortSignalFast): Promise<void> | void

  /** Waits until pool can hold the requested count, then gets objects */
  getWait(
    count: number,
    priority?: null | Priority,
    abortSignal?: null | IAbortSignalFast,
    awaitPriority?: null | AwaitPriority,
  ): Promise<TObject[]>

  use<TResult>(
    count: number,
    func: (
      objects: ReadonlyArray<TObject>,
      abortSignal?: null | IAbortSignalFast,
    ) => Promise<TResult> | TResult,
    priority?: null | Priority,
    abortSignal?: null | IAbortSignalFast,
    awaitPriority?: null | AwaitPriority,
  ): Promise<TResult>

  allocate(size?: null | number): Promise<number> | number
}

export type ObjectPoolArgs<TObject extends object> = {
  pool: IPool
  /** Custom storage for available objects */
  availableObjects?: null | IStackPool<TObject>
  /** Enables tracking of objects currently held and not yet released */
  heldObjects?: null | boolean | Set<TObject>
  create: () => Promise<TObject> | TObject
  destroy?: null | ((obj: TObject) => Promise<void> | void)
}

export class ObjectPool<TObject extends object>
  implements IObjectPool<TObject>
{
  private readonly _pool: IPool
  private readonly _allocatePool: IPool
  private readonly _availableObjects: IStackPool<TObject>
  private readonly _heldObjects: Set<TObject> | null
  private readonly _create?: null | (() => Promise<TObject> | TObject)
  private readonly _destroy?: null | ((obj: TObject) => Promise<void> | void)

  constructor({
    pool,
    availableObjects,
    heldObjects,
    destroy,
    create,
  }: ObjectPoolArgs<TObject>) {
    this._allocatePool = new Pool(pool.heldCountMax)
    this._pool = new Pools(pool, this._allocatePool)
    this._availableObjects = availableObjects || new StackPool()
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
    if (this._heldObjects && objects) {
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
  ): Promise<number> {
    return this._release(objects, this._pool, start, end)
  }

  private async _release(
    objects: TObject[],
    pool: IPool,
    start?: null | number,
    end?: null | number,
  ): Promise<number> {
    if (start == null) {
      start = 0
    }
    if (end == null) {
      end = objects.length
    }
    const tryReleaseCount = end - start
    const releasedCount = await pool.release(tryReleaseCount, true)

    end = Math.min(objects.length, releasedCount)
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

  tick(abortSignal?: null | IAbortSignalFast): Promise<void> | void {
    return this._pool.tick(abortSignal)
  }

  async getWait(
    count: number,
    priority?: null | Priority,
    abortSignal?: null | IAbortSignalFast,
    awaitPriority?: null | AwaitPriority,
  ): Promise<TObject[]> {
    await poolWait({
      pool: this._pool,
      count,
      hold: true,
      priority,
      abortSignal,
      awaitPriority,
    })
    return this.get(count)
  }

  async use<TResult>(
    count: number,
    func: (
      objects: ReadonlyArray<TObject>,
      abortSignal?: null | IAbortSignalFast,
    ) => Promise<TResult> | TResult,
    priority?: null | Priority,
    abortSignal?: null | IAbortSignalFast,
    awaitPriority?: null | AwaitPriority,
  ): Promise<TResult> {
    if (!this._create) {
      throw new Error(
        '[ObjectPool][use] You should specify create function in the constructor',
      )
    }
    let objects = await this.getWait(
      count,
      priority,
      abortSignal,
      awaitPriority,
    )

    let start
    if (!objects) {
      objects = new Array<TObject>(count)
      start = 0
    } else {
      start = objects.length
    }

    for (let i = start; i < count; i++) {
      const obj = await this._create()
      if (obj == null) {
        throw new Error(
          '[ObjectPool][use] create function should return not null object',
        )
      }
      if (this._heldObjects) {
        this._heldObjects.add(obj)
      }
      objects[i] = obj
    }
    try {
      const result = await func(objects, abortSignal)
      return result
    } finally {
      const releasedCount = await this.release(objects)
      if (this._destroy) {
        for (let i = releasedCount, len = objects.length; i < len; i++) {
          const obj = objects[i]
          await this._destroy(obj)
        }
      }
    }
  }

  allocate(size?: null | number): Promise<number> | number {
    if (!this._create) {
      throw new Error(
        '[ObjectPool][allocate] You should specify create function in the constructor',
      )
    }
    const promises: Promise<void>[] = []
    let tryHoldCount =
      this._allocatePool.holdAvailable - this._availableObjects.size
    if (size != null && size < tryHoldCount) {
      tryHoldCount = size
    }
    if (tryHoldCount < 0) {
      throw new Error(
        '[ObjectPool][allocate] Unexpected behavior: tryHoldCount < 0',
      )
    }
    const heldCount = this._allocatePool.hold(tryHoldCount) ? tryHoldCount : 0

    let allocatedCount = 0
    const _this = this
    async function releasePromiseObject(objectPromise: Promise<TObject>) {
      let obj: TObject
      try {
        obj = await objectPromise
      } catch (err) {
        await _this._allocatePool.release(1)
        throw err
      }
      const count = await _this._release([obj], _this._allocatePool)
      allocatedCount += count
    }

    async function releasePromise(promise: Promise<number>) {
      const count = await promise
      allocatedCount += count
    }

    for (let i = 0; i < heldCount; i++) {
      const objectOrPromise = this._create()
      if (isPromiseLike(objectOrPromise)) {
        promises.push(releasePromiseObject(objectOrPromise))
      } else {
        const promise = this._release([objectOrPromise], this._allocatePool)
        if (isPromiseLike(promise)) {
          promises.push(releasePromise(promise))
        }
      }
    }
    if (promises.length) {
      return Promise.all(promises).then(() => allocatedCount)
    }

    return allocatedCount
  }
}
