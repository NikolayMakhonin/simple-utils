import {
  IPriorityQueue,
  IPriorityQueueTask,
  PromiseOrValue,
  Task,
} from './contracts'
import { PairingHeap, PairingNode } from '@flemist/pairing-heap'
import {
  Priority,
  priorityCompare,
  priorityCreate,
} from 'src/common/async/priority/Priority'
import { IAbortSignalFast } from '@flemist/abort-controller-fast'
import { EMPTY_FUNC } from 'src/common/constants'

type QueueItem<T> = {
  func: ((abortSignal?: null | IAbortSignalFast) => PromiseOrValue<T>) | null
  abortSignal: IAbortSignalFast | null
  priority: Priority | null
  resolve: (value: T) => void
  reject: (error: any) => void
  readyToRun: boolean
}

export function queueItemLessThan(
  o1: QueueItem<any>,
  o2: QueueItem<any>,
): boolean {
  return priorityCompare(o1.priority, o2.priority) < 0
}

let nextOrder: number = 1

export class PriorityQueue implements IPriorityQueue, IPriorityQueueTask {
  readonly #queue: PairingHeap<QueueItem<any>>

  constructor() {
    this.#queue = new PairingHeap<QueueItem<any>>({
      lessThanFunc: queueItemLessThan,
    })
  }

  run<T>(
    func:
      | ((abortSignal?: null | IAbortSignalFast) => PromiseOrValue<T>)
      | null
      | undefined,
    priority?: null | Priority,
    abortSignal?: null | IAbortSignalFast,
  ): Promise<T> {
    return this._run(false, func, priority, abortSignal) as any
  }

  runTask<T>(
    func: (abortSignal?: null | IAbortSignalFast) => PromiseOrValue<T>,
    priority?: null | Priority,
    abortSignal?: null | IAbortSignalFast,
  ): Task<T> {
    return this._run(true, func, priority, abortSignal) as any
  }

  private _run<T>(
    taskMode: true | false,
    func:
      | ((abortSignal?: null | IAbortSignalFast) => PromiseOrValue<T>)
      | null
      | undefined,
    priority?: null | Priority,
    abortSignal?: null | IAbortSignalFast,
  ): Task<T> | Promise<T> {
    // const promise = new CustomPromise<T>(abortSignal)
    let resolve: (value: T) => void = null!
    let reject: (error: any) => void = null!
    const promise = new Promise<T>((res, rej) => {
      resolve = res
      reject = rej
    })

    const item: QueueItem<T> = {
      priority: priorityCreate(nextOrder++, priority),
      func: func ?? null,
      abortSignal: abortSignal ?? null,
      resolve,
      reject,
      readyToRun: !taskMode,
    }

    this.#queue.add(item)

    if (taskMode) {
      const _this = this

      return {
        result: promise,
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
    return promise
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
        let nextNode: PairingNode<QueueItem<any>> | null = null
        for (const node of queue.nodes()) {
          if (node.item.readyToRun) {
            nextNode = node
            break
          }
        }

        if (nextNode == null) {
          this.#inProcess = false
          break
        }

        item = nextNode.item
        queue.delete(nextNode)
      }

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
