import { AbortControllerFast } from '@flemist/abort-controller-fast'
import type { PromiseLikeOrValue } from 'src/common/types/common'
import {
  TASK_STOP,
  type TaskDelayPrepare,
  type TaskFuncOptions,
  type TaskStatusBase,
} from 'src/common/task/types'
import {
  createTaskRepeated,
  type TaskOptionsRepeated,
} from 'src/common/task/TaskRepeated'
import { timeControllerDefault } from '@flemist/time-controller'

export type WithRetryFunc<T> = (
  options: TaskFuncOptions,
) => PromiseLikeOrValue<T>

export type WithRetryOptions<T> = Omit<TaskOptionsRepeated<T>, 'delay'> & {
  func: WithRetryFunc<T>
  delay?: null | TaskDelayPrepare<T, TaskStatusBase<T>>
}

export async function withRetry<T>(options: WithRetryOptions<T>): Promise<T> {
  if (options.delay == null) {
    const abortSignal = options.abortSignal ?? new AbortControllerFast().signal
    abortSignal.throwIfAborted()
    const timeController = options.timeController ?? timeControllerDefault
    return options.func({ abortSignal, timeController, isFirst: true })
  }

  const task = createTaskRepeated<null, T>(
    (_, funcOptions) => {
      return options.func(funcOptions)
    },
    null,
    options as TaskOptionsRepeated<T>,
  )

  return task.run() as Promise<T>
}

export type TaskDelayRetryExponential = {
  min: number
  max: number
  mult?: null | number
}

export type CreateTaskDelayRetryOptions = {
  maxRetries?: null | number
  maxTotalTime?: null | number
  delays: null | undefined | number[] | TaskDelayRetryExponential
  /**
   * Random multiplicative jitter factor (>= 1): result uniformly distributed
   * in [value / jitter, value * jitter].
   * 1 or null disables jitter.
   */
  jitter?: null | number
}

/** Creates a TaskDelay for retrying failed operations with exponential or fixed delays */
export function createTaskDelayRetry({
  maxRetries,
  maxTotalTime,
  delays,
  jitter,
}: CreateTaskDelayRetryOptions): TaskDelayPrepare<any> {
  return function taskDelayRetry(status) {
    if (status.lastSuccess != null) {
      return TASK_STOP
    }

    const failedRuns = status.lastFailedRuns ?? 0

    if (
      (maxRetries != null && failedRuns > maxRetries) ||
      (maxTotalTime != null &&
        status.firstStart != null &&
        status.timeController.now() - status.firstStart > maxTotalTime)
    ) {
      return TASK_STOP
    }

    return {
      delay: status => {
        if (
          !status.lastFailedRuns ||
          delays == null ||
          (Array.isArray(delays) && delays.length === 0)
        ) {
          return undefined
        }

        const retryIndex = status.lastFailedRuns - 1

        let value: number
        if (Array.isArray(delays)) {
          value = delays[Math.min(retryIndex, delays.length - 1)]
        } else {
          const mult = delays.mult ?? 2
          value = Math.min(delays.min * mult ** retryIndex, delays.max)
        }
        if (jitter != null && jitter !== 1) {
          const lo = value / jitter
          const hi = value * jitter
          value = lo + Math.random() * (hi - lo)
        }

        return value
      },
    }
  }
}
