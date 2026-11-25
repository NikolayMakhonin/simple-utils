import { AbortControllerFast } from '@flemist/abort-controller-fast'
import type { PromiseLikeOrValue } from 'src/common/types/common'
import { type TaskFuncOptions } from 'src/common/task/types'
import {
  createTaskRepeated,
  type TaskOptionsRepeated,
} from 'src/common/task/TaskRepeated'
import { clockReal } from 'src/common/time/clock'

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
    const clock = options.clock ?? clockReal
    return options.func({ abortSignal, clock, isFirst: true })
  }

  const { repeated } = createTaskRepeated<null, T>(
    (_, funcOptions) => {
      return options.func(funcOptions)
    },
    null,
    options,
  )

  try {
    return await repeated.run()
  } catch (error) {
    // A task aborted in the pause between two attempts ends with the error of the last attempt.
    // The caller should get the abort instead, to tell it from a failure
    options.abortSignal?.throwIfAborted()
    throw error
  }
}
