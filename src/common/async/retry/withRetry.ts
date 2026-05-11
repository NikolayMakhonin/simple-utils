import { AbortControllerFast } from '@flemist/abort-controller-fast'
import type { PromiseLikeOrValue } from 'src/common/types/common'
import { type TaskFuncOptions } from 'src/common/task/types'
import {
  createTaskRepeated,
  type TaskOptionsRepeated,
} from 'src/common/task/TaskRepeated'
import { timeControllerDefault } from '@flemist/time-controller'

export type WithRetryFunc<T> = (
  options: TaskFuncOptions,
) => PromiseLikeOrValue<T>

export type WithRetryOptions<T> = {
  func: WithRetryFunc<T>
} & (
  | (Omit<TaskOptionsRepeated<T>, 'repeatStrategy'> & {
      repeatStrategy?: null
    })
  | TaskOptionsRepeated<T>
)

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
    options,
  )

  return repeated.run()
}
