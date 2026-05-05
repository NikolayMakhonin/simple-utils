import type { IAbortSignalFast } from '@flemist/abort-controller-fast'
import type { PromiseOrValue } from 'src/common/types/common'
import {
  TASK_STOP,
  type TaskDelayPrepare,
  type TaskStatusBase,
} from 'src/common/task/types'
import {
  createTaskRepeated,
  type TaskOptionsRepeated,
} from 'src/common/task/TaskRepeated'

export type WithRetryFuncArg = {
  abortSignal: IAbortSignalFast | null
}

export type WithRetryFunc<T> = (args: WithRetryFuncArg) => PromiseOrValue<T>

export type WithRetryOptions<T> = Omit<TaskOptionsRepeated<T>, 'delay'> & {
  func: WithRetryFunc<T>
  delay?: null | TaskDelayPrepare<T, TaskStatusBase<T>>
}

export async function withRetry<T>(options: WithRetryOptions<T>): Promise<T> {
  if (options.delay == null) {
    return options.func({ abortSignal: options.abortSignal ?? null })
  }

  const task = createTaskRepeated<null, T>(
    (_, taskFuncOptions) => {
      return options.func(taskFuncOptions)
    },
    null,
    options as TaskOptionsRepeated<T>,
  )

  return task.run() as Promise<T>
}

export type CreateTaskDelayRetryOptions = {
  maxRetries?: null | number
  maxTotalTime?: null | number
  delays: number[] | { min: number; max: number; mult?: null | number }
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
        if (!status.lastFailedRuns) {
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
