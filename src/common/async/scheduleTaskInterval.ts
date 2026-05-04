import type { IAbortSignalFast } from '@flemist/abort-controller-fast'
import { AbortControllerFast } from '@flemist/abort-controller-fast'
import type { Unsubscribe } from '@flemist/simple-utils'
import { delay } from '@flemist/async-utils'
import {
  type ITimeController,
  timeControllerDefault,
} from '@flemist/time-controller'
import { LogLevel } from '@flemist/simple-utils'
import type { TaskDelay } from '@flemist/simple-utils'

export type ScheduleTaskIntervalFuncArg = {
  abortSignal: IAbortSignalFast
}

export type ScheduleTaskIntervalFunc = (
  args: ScheduleTaskIntervalFuncArg,
) => Promise<void>

export type ScheduleTaskIntervalOptions = {
  func: ScheduleTaskIntervalFunc
  delay: TaskDelay
  skipFirst?: null | boolean
  timeController?: null | ITimeController
  logLevel?: null | LogLevel
}

export function scheduleTaskInterval(
  options: ScheduleTaskIntervalOptions,
): Unsubscribe {
  const abortController = new AbortControllerFast()
  const abortSignal = abortController.signal
  const timeController = options.timeController ?? timeControllerDefault

  async function process() {
    let first = true
    let lastError: any = null
    let retryCount: null | number = null
    let timeStart = timeController.now()
    while (!abortSignal.aborted) {
      try {
        const __delay = options.delay({
          error: lastError,
          retryCount,
          abortSignal,
          timeStart,
        })

        if (__delay == null) {
          return
        }

        if (!first || !options.skipFirst) {
          await options.func({ abortSignal })
        }

        if (typeof __delay === 'number') {
          await delay(__delay, abortSignal, timeController)
        } else {
          await __delay()
        }

        lastError = null
        retryCount = null
        timeStart = timeController.now()
      } catch (error) {
        if (abortSignal.aborted) {
          return
        }
        lastError = error
        retryCount = retryCount == null ? 0 : retryCount + 1
        if (options.logLevel == null || options.logLevel >= LogLevel.error) {
          console.error('[scheduleTaskInterval] task execution failed', error)
        }
      }
      first = false
    }
  }

  void process()
  return () => {
    abortController.abort()
  }
}
