import type { IAbortSignalFast } from '@flemist/abort-controller-fast'
import { scheduleTaskInterval } from './scheduleTaskInterval'
import type { PromiseOrValue } from '@flemist/simple-utils'
import type { ITimeController } from '@flemist/time-controller'
import type { LogLevel } from '@flemist/simple-utils'
import type { TaskDelay } from '@flemist/simple-utils'

export type ScheduleSyncOptions = {
  delay: TaskDelay
  onError?: null | ((error: any) => PromiseOrValue<any>)
  executeTasks: (args: { abortSignal: IAbortSignalFast }) => PromiseLike<any>[]
  skipFirst?: null | boolean
  timeController?: null | ITimeController
  logLevel?: null | LogLevel
}

export function scheduleSync(options: ScheduleSyncOptions) {
  return scheduleTaskInterval({
    skipFirst: options.skipFirst,
    delay: options.delay,
    timeController: options.timeController,
    logLevel: options.logLevel,
    func: async ({ abortSignal }) => {
      let results: PromiseSettledResult<any>[]
      try {
        results = await Promise.allSettled(
          options.executeTasks({ abortSignal }),
        )
      } catch (error) {
        await options.onError?.(error)
        throw error
      }

      for (let i = 0, len = results.length; i < len; i++) {
        const result = results[i]
        if (result.status === 'rejected') {
          await options.onError?.(result.reason)
          throw result.reason
        }
      }
    },
  })
}
