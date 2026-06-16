import { type IAbortSignalFast } from '@flemist/abort-controller-fast'
import { type IPool } from './Pool'

export class PoolWrapper implements IPool {
  protected readonly _pool: IPool

  constructor(pool: IPool) {
    this._pool = pool
  }

  get heldCountMax(): number {
    return this._pool.heldCountMax
  }

  get heldCount(): number {
    return this._pool.heldCount
  }

  get holdAvailable(): number {
    return this._pool.holdAvailable
  }

  get releaseAvailable(): number {
    return this._pool.releaseAvailable
  }

  canHold(count: number): boolean {
    return this._pool.canHold(count)
  }

  hold(count: number) {
    return this._pool.hold(count)
  }

  release(count: number, dontThrow?: null | boolean) {
    return this._pool.release(count, dontThrow)
  }

  tick(abortSignal?: null | IAbortSignalFast): Promise<void> | void {
    return this._pool.tick(abortSignal)
  }
}
