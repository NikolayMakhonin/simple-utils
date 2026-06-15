import type { IAbortSignalFast } from '@flemist/abort-controller-fast'
import type { Priority } from 'src/common/async/priority/Priority'
import type { PromiseOrValue } from 'src/common/types/common'

export type PriorityQueueTask<T> = {
  readonly result: Promise<T>
  readonly setReadyToRun: (readyToRun: boolean) => void
}

export type PriorityQueueRunFunc<T> = (
  abortSignal?: null | IAbortSignalFast,
) => PromiseOrValue<T>

export interface IPriorityQueue {
  run<T>(
    func: PriorityQueueRunFunc<T> | null | undefined,
    priority?: null | Priority,
    abortSignal?: null | IAbortSignalFast,
  ): Promise<T>
}

export interface IPriorityQueueRunTask {
  runTask<T>(
    func: PriorityQueueRunFunc<T> | null | undefined,
    priority?: null | Priority,
    abortSignal?: null | IAbortSignalFast,
  ): PriorityQueueTask<T>
}
