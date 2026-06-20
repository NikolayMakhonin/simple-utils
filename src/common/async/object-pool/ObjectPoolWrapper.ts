import { type IAbortSignalFast } from '@flemist/abort-controller-fast'
import type {
  PromiseLikeOrValue,
  PromiseOrValue,
} from 'src/common/types/common'
import { type Priority } from 'src/common/async/priority/Priority'
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

  get heldObjects(): ReadonlySet<TObject> | null {
    return this._objectPool.heldObjects
  }

  get pool(): IPool {
    return this._objectPool.pool
  }

  allocate(size?: null | number): PromiseOrValue<number> {
    return this._objectPool.allocate(size)
  }

  get(count: number): TObject[] {
    return this._objectPool.get(count)
  }

  getWait(
    count: number,
    priority?: null | Priority,
    abortSignal?: null | IAbortSignalFast,
  ): Promise<TObject[]> {
    return this._objectPool.getWait(count, priority, abortSignal)
  }

  release(
    objects: TObject[],
    start?: null | number,
    end?: null | number,
  ): PromiseOrValue<number> {
    return this._objectPool.release(objects, start, end)
  }

  tick(abortSignal?: null | IAbortSignalFast): PromiseOrValue<void> {
    return this._objectPool.tick(abortSignal)
  }

  use<TResult>(
    count: number,
    func: (
      objects: ReadonlyArray<TObject>,
      abortSignal?: null | IAbortSignalFast,
    ) => PromiseLikeOrValue<TResult>,
    priority?: null | Priority,
    abortSignal?: null | IAbortSignalFast,
  ): Promise<TResult> {
    return this._objectPool.use(count, func, priority, abortSignal)
  }
}
