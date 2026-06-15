import { IAbortSignalFast } from '@flemist/abort-controller-fast'
import { Priority } from 'src/common/async/priority/Priority'

export type PromiseOrValue<T> = T | Promise<T>

export type TCompare<T> = (o1: T, o2: T) => number

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
