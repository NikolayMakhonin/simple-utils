import { PriorityQueue } from './PriorityQueue'
import { Priority } from 'src/common/async/priority/Priority'
import { IAbortSignalFast } from '@flemist/abort-controller-fast'

export type AwaitPriority = (
  priority?: null | Priority,
  abortSignal?: null | IAbortSignalFast,
) => Promise<void>

export function createAwaitPriority(): AwaitPriority {
  const priorityQueue = new PriorityQueue()
  return function awaitPriority(
    priority?: null | Priority,
    abortSignal?: null | IAbortSignalFast,
  ) {
    return priorityQueue.run(null, priority, abortSignal)
  }
}

export const awaitPriorityDefault = createAwaitPriority()
