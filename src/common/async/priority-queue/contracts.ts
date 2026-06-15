import type { IAbortSignalFast } from '@flemist/abort-controller-fast'
import type { Priority } from 'src/common/async/priority/Priority'
import type { PromiseOrValue } from 'src/common/types/common'

export type Task<T> = {
  result: Promise<T>
  setReadyToRun: (readyToRun: boolean) => void
}

export interface IPriorityQueue {
  run<T>(
    func:
      | ((abortSignal?: null | IAbortSignalFast) => PromiseOrValue<T>)
      | null
      | undefined,
    priority?: null | Priority,
    abortSignal?: null | IAbortSignalFast,
  ): Promise<T>
}

export interface IPriorityQueueTask {
  runTask<T>(
    func: (abortSignal?: null | IAbortSignalFast) => PromiseOrValue<T>,
    priority?: null | Priority,
    abortSignal?: null | IAbortSignalFast,
  ): Task<T>
}
