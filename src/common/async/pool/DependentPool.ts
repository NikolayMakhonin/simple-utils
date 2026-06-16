import { type IAbortSignalFast } from '@flemist/abort-controller-fast'
import { type IPool } from './Pool'
import { PoolWrapper } from './PoolWrapper'

/**
 * К текущему size прибавляется size всех зависимостей.
 * Таким образом, этому пулу нужно будет ждать все зависимые пулы, но при этом не блокировать их.
 * Пример использования: есть 2 пула на загрузку данных, один загружает данные фоново, а второй для срочной загрузки по требованию. Чтобы добавить новую фоновую задачу, нужно убедиться что общее количество задач во всех пулах не превышает лимит. Но если нужно добавить срочную задачу, то нужно убедиться что только в срочном пуле есть место. В худшем случае будут заняты оба пула, но ненадолго, т.к. фоновые задачи будут завершаться, а новые фоновые задачи не будут добавляться, пока не освободится место.
 */
export class DependentPool extends PoolWrapper {
  private readonly _pools: IPool[]

  constructor(pool: IPool, ...dependencies: IPool[]) {
    super(pool)
    this._pools = dependencies
  }

  get heldCount() {
    let heldCount: number = this._pool.heldCount
    const pools = this._pools
    for (let i = 0, len = pools.length; i < len; i++) {
      heldCount += pools[i].heldCount
    }
    return heldCount
  }

  get holdAvailable() {
    return Math.max(0, this.heldCountMax - this.heldCount)
  }

  canHold(count: number): boolean {
    return this.heldCount === 0 || count <= this.holdAvailable
  }

  hold(count: number): boolean {
    if (!this.canHold(count)) {
      return false
    }
    return this._pool.hold(count)
  }

  tick(abortSignal?: null | IAbortSignalFast): Promise<void> | void {
    let promises: Promise<void>[] | null = null
    const promise = this._pool.tick(abortSignal)
    if (promise) {
      promises = [promise]
    }
    for (let i = 0, len = this._pools.length; i < len; i++) {
      const promise = this._pools[i].tick(abortSignal)
      if (promise) {
        if (!promises) {
          promises = [promise]
        } else {
          promises.push(promise)
        }
      }
    }

    if (!promises) {
      return
    }

    return Promise.race(promises)
  }
}
