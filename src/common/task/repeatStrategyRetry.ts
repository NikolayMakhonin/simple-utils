import type { TaskRepeatStrategy } from './types'

export type RetryDelaysExponential = {
  min: number
  max: number
  mult?: null | number
}

export type RepeatStrategyRetryOptions = {
  maxRetries?: null | number
  maxTotalTime?: null | number
  delays: null | undefined | number[] | RetryDelaysExponential
  /**
   * Random multiplicative jitter factor (>= 1): result uniformly distributed
   * in [value / jitter, value * jitter].
   * 1 or null disables jitter.
   */
  jitter?: null | number
}

/** Retries on failure with configurable delay, max retries, and max total time */
export function repeatStrategyRetry({
  maxRetries,
  maxTotalTime,
  delays,
  jitter,
}: RepeatStrategyRetryOptions): TaskRepeatStrategy {
  return function retryStrategy(status) {
    const failedRuns = status.lastFailedRuns ?? 0

    if (
      (maxRetries != null && failedRuns > maxRetries) ||
      (maxTotalTime != null &&
        status.firstStart != null &&
        status.timeController.now() - status.firstStart > maxTotalTime)
    ) {
      return { stop: true }
    }

    return {
      delay: status => {
        if (status.lastSuccessRuns) {
          return { stop: true }
        }

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
