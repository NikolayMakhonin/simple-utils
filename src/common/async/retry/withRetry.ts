import type { IAbortSignalFast } from '@flemist/abort-controller-fast'
import { delay } from '@flemist/async-utils'
import type { PromiseOrValue } from 'src/common/types/common'
import {
  type ITimeController,
  timeControllerDefault,
} from '@flemist/time-controller'
import { LogLevel } from 'src/common/debug/LogLevel'
import type { TaskDelay } from './types'

export type WithRetryFuncArg = {
  abortSignal: IAbortSignalFast | null
}

export type WithRetryFunc<T> = (args: WithRetryFuncArg) => PromiseOrValue<T>

export type WithRetryOptions<T> = {
  func: WithRetryFunc<T>
  delay: TaskDelay
  abortSignal?: null | IAbortSignalFast
  timeController?: null | ITimeController
  logLevel?: null | LogLevel
}

export async function withRetry<T>(options: WithRetryOptions<T>): Promise<T> {
  const abortSignal = options.abortSignal ?? null
  const timeController = options.timeController ?? timeControllerDefault
  const timeStart = Date.now()
  let retryCount = 0

  while (true) {
    try {
      return await options.func({ abortSignal })
    } catch (error) {
      if (options.logLevel == null || options.logLevel >= LogLevel.error) {
        console.error('[withRetry] error', error)
      }
      if (abortSignal?.aborted) {
        throw error
      }

      const __delay = options.delay({
        error,
        retryCount: retryCount++,
        timeStart,
        abortSignal,
      })
      if (__delay == null) {
        throw error
      }

      if (typeof __delay === 'number') {
        await delay(__delay, abortSignal ?? undefined, timeController)
      } else {
        await __delay()
      }

      if (abortSignal?.aborted) {
        throw error
      }
    }
  }
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
  isRetriableError?: null | ((error: any) => boolean)
}

/** Creates a TaskDelay for retrying failed operations with exponential or fixed delays */
export function createTaskDelayRetry({
  maxRetries,
  maxTotalTime,
  delays,
  jitter,
  isRetriableError,
}: CreateTaskDelayRetryOptions): TaskDelay {
  return function taskDelayRetry({ retryCount, timeStart, error }) {
    if (
      retryCount == null ||
      (maxRetries != null && retryCount >= maxRetries) ||
      (maxTotalTime != null && Date.now() - timeStart > maxTotalTime)
    ) {
      return null
    }
    if (isRetriableError == null || isRetriableError(error)) {
      let value: number
      if (Array.isArray(delays)) {
        value = delays[Math.min(retryCount, delays.length - 1)]
      } else {
        const mult = delays.mult ?? 2
        value = Math.min(delays.min * mult ** retryCount, delays.max)
      }
      if (jitter != null && jitter !== 1) {
        const lo = value / jitter
        const hi = value * jitter
        value = lo + Math.random() * (hi - lo)
      }
      return value
    }
    return null
  }
}
