import type {
  IPriorityQueue,
  IPriorityQueueRunTask,
  PriorityQueueTask,
  PriorityQueueRunFunc,
} from './contracts'
import type { PromiseOrValue } from 'src/common/types/common'
import { PairingHeap, PairingNode } from '@flemist/pairing-heap'
import {
  type Priority,
  priorityCompare,
  priorityCreate,
} from 'src/common/async/priority/Priority'
import type { IAbortSignalFast } from '@flemist/abort-controller-fast'
import { EMPTY_FUNC } from 'src/common/constants'
import { ManualPromise } from 'src/common/async/promise'

type QueueItem<T> = {
  func: ((abortSignal?: null | IAbortSignalFast) => PromiseOrValue<T>) | null
  abortSignal: IAbortSignalFast | null
  priority: Priority | null
  resolve: (value: T) => void
  reject: (error: any) => void
  readyToRun: boolean
  node: PairingNode<QueueItem<T>> | null
}

function queueItemLessThan(o1: QueueItem<any>, o2: QueueItem<any>): boolean {
  return priorityCompare(o1.priority, o2.priority) < 0
}

export class PriorityQueue implements IPriorityQueue, IPriorityQueueRunTask {
  readonly #queue: PairingHeap<QueueItem<any>>
  #nextOrder: number = 1

  constructor() {
    this.#queue = new PairingHeap<QueueItem<any>>({
      lessThanFunc: queueItemLessThan,
    })
  }

  run<T>(
    func: PriorityQueueRunFunc<T> | null | undefined,
    priority?: null | Priority,
    abortSignal?: null | IAbortSignalFast,
  ): Promise<T> {
    return this._run(false, func, priority, abortSignal) as any
  }

  runTask<T>(
    func: PriorityQueueRunFunc<T> | null | undefined,
    priority?: null | Priority,
    abortSignal?: null | IAbortSignalFast,
  ): PriorityQueueTask<T> {
    return this._run(true, func, priority, abortSignal) as any
  }

  private _run<T>(
    taskMode: boolean,
    func:
      | ((abortSignal?: null | IAbortSignalFast) => PromiseOrValue<T>)
      | null
      | undefined,
    priority?: null | Priority,
    abortSignal?: null | IAbortSignalFast,
  ): PriorityQueueTask<T> | Promise<T> {
    // const promise = new CustomPromise<T>(abortSignal)
    const promise = new ManualPromise<T>()

    const item: QueueItem<T> = {
      priority: priorityCreate(this.#nextOrder++, priority),
      func: func ?? null,
      abortSignal: abortSignal ?? null,
      resolve: promise.resolve,
      reject: promise.reject,
      readyToRun: !taskMode,
      node: null,
    }

    item.node = this.#queue.add(item)

    if (abortSignal) {
      if (abortSignal.aborted) {
        this.#queue.delete(item.node)
        item.node = null
        promise.reject(abortSignal.reason)
        return taskMode
          ? ({ result: promise, setReadyToRun: EMPTY_FUNC } as any)
          : promise
      }
      abortSignal.subscribe(reason => {
        if (item.node != null) {
          this.#queue.delete(item.node)
          item.node = null
          item.reject(reason)
        }
      })
    }

    if (taskMode) {
      const _this = this

      return {
        result: promise.promise,
        setReadyToRun(readyToRun: boolean) {
          item.readyToRun = readyToRun
          if (readyToRun && !_this.#inProcess) {
            _this.#inProcess = true
            void _this._process()
          }
        },
      }
    }

    if (!this.#inProcess) {
      this.#inProcess = true
      void this._process()
    }
    return promise.promise
  }

  #inProcess: boolean = false
  private async _process() {
    const queue = this.#queue

    // чтобы сначала сформировалась очередь, а потом началось выполнение в порядке приоритета
    // тесты показывают что только такая длинная конструкция прерывает выполнение программы и дает синхронному коду заполнить очередь перед началом выполнения
    await Promise.resolve().then(EMPTY_FUNC)

    while (true) {
      await 0
      // await Promise.resolve()

      // void Promise.resolve().then(EMPTY_FUNC).then(next)

      let item = queue.getMin()

      if (item == null) {
        this.#inProcess = false
        break
      }

      if (item.readyToRun) {
        queue.deleteMin()
      } else {
        let bestNode: PairingNode<QueueItem<any>> | null = null
        for (const node of queue.nodes()) {
          if (node.item.readyToRun) {
            if (
              bestNode == null ||
              queueItemLessThan(node.item, bestNode.item)
            ) {
              bestNode = node
            }
          }
        }

        if (bestNode == null) {
          this.#inProcess = false
          break
        }

        item = bestNode.item
        queue.delete(bestNode)
      }

      item.node = null

      if (item.abortSignal && item.abortSignal.aborted) {
        item.reject(item.abortSignal.reason)
      } else {
        try {
          let result = item.func && item.func(item.abortSignal)
          if (result && typeof result.then === 'function') {
            result = await result
          }
          item.resolve(result)
        } catch (err) {
          item.reject(err)
        }
      }
    }
  }
}
