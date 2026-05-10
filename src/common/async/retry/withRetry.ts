import { AbortControllerFast } from '@flemist/abort-controller-fast'
import type { PromiseLikeOrValue } from 'src/common/types/common'
import {
  type TaskRepeatStrategy,
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

export type WithRetryOptions<T> = Omit<
  TaskOptionsRepeated<T>,
  'repeatStrategy'
> & {
  func: WithRetryFunc<T>
  repeatStrategy?: null | TaskRepeatStrategy<T, TaskStatusBase<T>>
}

export async function withRetry<T>(options: WithRetryOptions<T>): Promise<T> {
  if (options.repeatStrategy == null) {
    const abortSignal = options.abortSignal ?? new AbortControllerFast().signal
    abortSignal.throwIfAborted()
    const timeController = options.timeController ?? timeControllerDefault
    return options.func({ abortSignal, timeController, isFirst: true })
  }

  const { repeated } = createTaskRepeated<null, T>(
    (_, funcOptions) => {
      return options.func(funcOptions)
    },
    null,
    {
      ...options,
      repeatStrategy: options.repeatStrategy,
    },
  )

  return repeated.run()
}
