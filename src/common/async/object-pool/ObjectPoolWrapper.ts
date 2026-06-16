import { type IAbortSignalFast } from '@flemist/abort-controller-fast'
import { type Priority } from 'src/common/async/priority/Priority'
import { type AwaitPriority } from 'src/common/async/priority-queue/helpers'
import { type IPool } from 'src/common/async/pool/Pool'
import { type IObjectPool } from './ObjectPool'

export class ObjectPoolWrapper<TObject extends object>
  implements IObjectPool<TObject>
{
  protected readonly _objectPool: IObjectPool<TObject>

  constructor(objectPool: IObjectPool<TObject>) {
    this._objectPool = objectPool
  }

  get availableObjects(): ReadonlyArray<TObject> {
    return this._objectPool.availableObjects
  }

  get pool(): IPool {
    return this._objectPool.pool
  }

  allocate(size?: null | number): Promise<number> | number {
    return this._objectPool.allocate(size)
  }

  get(count: number): TObject[] {
    return this._objectPool.get(count)
  }

  getWait(
    count: number,
    priority?: null | Priority,
    abortSignal?: null | IAbortSignalFast,
    awaitPriority?: null | AwaitPriority,
  ): Promise<TObject[]> {
    return this._objectPool.getWait(count, priority, abortSignal, awaitPriority)
  }

  release(
    objects: TObject[],
    start?: null | number,
    end?: null | number,
  ): Promise<number> | number {
    return this._objectPool.release(objects, start, end)
  }

  tick(abortSignal?: null | IAbortSignalFast): Promise<void> | void {
    return this._objectPool.tick(abortSignal)
  }

  use<TResult>(
    count: number,
    func: (
      objects: ReadonlyArray<TObject>,
      abortSignal?: null | IAbortSignalFast,
    ) => Promise<TResult> | TResult,
    priority?: null | Priority,
    abortSignal?: null | IAbortSignalFast,
    awaitPriority?: null | AwaitPriority,
  ): Promise<TResult> {
    return this._objectPool.use(
      count,
      func,
      priority,
      abortSignal,
      awaitPriority,
    )
  }
}
