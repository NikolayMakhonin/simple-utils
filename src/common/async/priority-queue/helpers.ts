import { PriorityQueue } from './PriorityQueue'
import type { Priority } from 'src/common/async/priority/Priority'
import type { IAbortSignalFast } from '@flemist/abort-controller-fast'

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

let _priorityQueueGlobal: PriorityQueue | null = null
export function getPriorityQueueGlobal(): PriorityQueue {
  if (!_priorityQueueGlobal) {
    _priorityQueueGlobal = new PriorityQueue()
  }
  return _priorityQueueGlobal
}

let _awaitPriorityDefault: AwaitPriority | null = null
export function awaitPriorityDefault(
  priority?: null | Priority,
  abortSignal?: null | IAbortSignalFast,
): Promise<void> {
  if (!_awaitPriorityDefault) {
    _awaitPriorityDefault = createAwaitPriority()
  }
  return _awaitPriorityDefault(priority, abortSignal)
}
