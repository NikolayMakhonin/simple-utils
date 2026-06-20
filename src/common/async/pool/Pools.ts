import { type IAbortSignalFast } from '@flemist/abort-controller-fast'
import type { PromiseOrValue } from 'src/common/types/common'
import { isPromiseLike } from 'src/common/async/promise/isPromiseLike'
import { type IPool } from './Pool'
import {
  type IPriorityQueue,
  PriorityQueue,
} from 'src/common/async/priority-queue'

/** Composite pool that delegates operations to multiple underlying pools */
export class Pools implements IPool {
  private readonly _priorityQueue: IPriorityQueue
  private readonly _pools: IPool[]

  constructor(...pools: IPool[]) {
    if (!pools.length) {
      throw new Error('[Pools][constructor] pools should not be empty')
    }
    this._priorityQueue = new PriorityQueue()
    this._pools = pools
  }

  get priorityQueue(): IPriorityQueue {
    return this._priorityQueue
  }

  get heldCountMax() {
    return poolsHeldCountMax(this._pools)
  }

  get heldCount() {
    return poolsHeldCount(this._pools)
  }

  get holdAvailable() {
    return poolsHoldAvailable(this._pools)
  }

  get releaseAvailable() {
    return poolsReleaseAvailable(this._pools)
  }

  canHold(count: number | number[]): boolean {
    return poolsCanHold(this._pools, count)
  }

  hold(count: number | number[]): boolean {
    return poolsHold(this._pools, count)
  }

  release(count: number, dontThrow?: null | boolean): PromiseOrValue<number>
  release(count: number[], dontThrow?: null | boolean): PromiseOrValue<number[]>
  release(
    count: number | number[],
    dontThrow?: null | boolean,
  ): PromiseOrValue<number | number[]> {
    return poolsRelease(this._pools, count, dontThrow)
  }

  tick(abortSignal?: null | IAbortSignalFast): PromiseOrValue<void> {
    return poolsTick(this._pools, abortSignal)
  }
}

function poolsHeldCountMax(pools: IPool[]) {
  let min = pools[0].heldCountMax
  for (let i = 1, len = pools.length; i < len; i++) {
    const value = pools[i].heldCountMax
    if (value < min) {
      min = value
    }
  }
  return min
}

function poolsHeldCount(pools: IPool[]) {
  let max = pools[0].heldCount
  for (let i = 1, len = pools.length; i < len; i++) {
    const value = pools[i].heldCount
    if (value > max) {
      max = value
    }
  }
  return max
}

function poolsHoldAvailable(pools: IPool[]) {
  let min = pools[0].holdAvailable
  for (let i = 1, len = pools.length; i < len; i++) {
    const value = pools[i].holdAvailable
    if (value < min) {
      min = value
    }
  }
  return min
}

function poolsReleaseAvailable(pools: IPool[]): number {
  let min = pools[0].releaseAvailable
  for (let i = 1, len = pools.length; i < len; i++) {
    const value = pools[i].releaseAvailable
    if (value < min) {
      min = value
    }
  }
  return min
}

export function poolsCanHold(
  pools: IPool[],
  count: number | number[],
): boolean {
  const len = pools.length
  if (typeof count !== 'number' && count.length !== len) {
    throw new Error(
      `[poolsCanHold] count.length (${count.length}) !== pools.length (${len})`,
    )
  }
  for (let i = 0; i < len; i++) {
    const pool = pools[i]
    if (!pool.canHold(typeof count === 'number' ? count : count[i])) {
      return false
    }
  }
  return true
}

export function poolsHold(pools: IPool[], count: number | number[]): boolean {
  if (!poolsCanHold(pools, count)) {
    return false
  }
  for (let i = 0, len = pools.length; i < len; i++) {
    if (!pools[i].hold(typeof count === 'number' ? count : count[i])) {
      throw new Error('[poolsHold] hold failed after canHold succeeded')
    }
  }
  return true
}

export function poolsRelease(
  pools: IPool[],
  count: number,
  dontThrow?: null | boolean,
): PromiseOrValue<number>
export function poolsRelease(
  pools: IPool[],
  count: number[],
  dontThrow?: null | boolean,
): PromiseOrValue<number[]>
export function poolsRelease(
  pools: IPool[],
  count: number | number[],
  dontThrow?: null | boolean,
): PromiseOrValue<number | number[]>
export function poolsRelease(
  pools: IPool[],
  count: number | number[],
  dontThrow?: null | boolean,
): PromiseOrValue<number | number[]> {
  if (typeof count === 'number') {
    const releaseAvailable = poolsReleaseAvailable(pools)
    if (count > releaseAvailable) {
      if (dontThrow) {
        count = releaseAvailable
      } else {
        throw new Error(
          `[poolsRelease] count (${count}) > releaseAvailable (${releaseAvailable})`,
        )
      }
    }
    if (count === 0) {
      return 0
    }
  } else {
    const len = pools.length
    if (count.length !== len) {
      throw new Error(
        `[poolsRelease] count.length (${count.length}) !== pools.length (${len})`,
      )
    }

    if (dontThrow) {
      let cloned = false
      for (let i = 0; i < len; i++) {
        const releaseAvailable = pools[i].releaseAvailable
        if (count[i] > releaseAvailable) {
          if (!cloned) {
            count = count.slice()
            cloned = true
          }
          count[i] = releaseAvailable
        }
      }
    } else {
      for (let i = 0; i < len; i++) {
        const releaseAvailable = pools[i].releaseAvailable
        if (count[i] > releaseAvailable) {
          throw new Error(
            `[poolsRelease] count[${i}] (${count[i]}) > releaseAvailable (${releaseAvailable})`,
          )
        }
      }
    }
  }

  let promises: Promise<number>[] | null = null
  for (let i = 0, len = pools.length; i < len; i++) {
    const promise = pools[i].release(
      typeof count === 'number' ? count : count[i],
      dontThrow,
    )
    if (isPromiseLike(promise)) {
      if (!promises) {
        promises = [promise]
      } else {
        promises.push(promise)
      }
    }
  }
  if (promises) {
    return Promise.all(promises).then(() => count)
  }

  return count
}

export function poolsTick(
  pools: IPool[],
  abortSignal?: null | IAbortSignalFast,
): PromiseOrValue<void> {
  let promises: Promise<void>[] | null = null
  for (let i = 0, len = pools.length; i < len; i++) {
    const promise = pools[i].tick(abortSignal)
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

/*
export function poolsWait({
  priorityQueue,
  pools,
  count,
  priority,
  abortSignal,
}: {
  priorityQueue: IPriorityQueue
  pools: IPool[]
  count: number | number[]
  priority?: null | Priority
  abortSignal?: null | IAbortSignalFast
}): Promise<void> {
  const len = pools.length
  if (typeof count !== 'number' && count.length !== len) {
    throw new Error(
      `[poolsWait] count.length (${count.length}) !== pools.length (${len})`,
    )
  }

  return priorityQueue.run(
    async abortSignal => {
      while (!poolsCanHold(pools, count)) {
        await poolsTick(pools, abortSignal)
      }
    },
    priority,
    abortSignal,
  )
}

export async function poolsWaitHold({
  priorityQueue,
  pools,
  count,
  priority,
  abortSignal,
}: {
  priorityQueue: IPriorityQueue
  pools: IPool[]
  count: number | number[]
  priority?: null | Priority
  abortSignal?: null | IAbortSignalFast
}): Promise<void> {
  await poolsWait({ priorityQueue, pools, count, priority, abortSignal })
  if (!poolsHold(pools, count)) {
    throw new Error('[poolsWaitHold] hold failed after wait succeeded')
  }
}
*/
