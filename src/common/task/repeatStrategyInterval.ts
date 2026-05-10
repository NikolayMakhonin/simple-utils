import type { TaskRepeatStrategy } from './types'

export type RepeatStrategyIntervalOptions = {
  interval: number
  /**
   * true - stop repeating if last execution failed
   * false - do not stop repeating if last execution failed
   * null/undefined - not set, does not overwrite previous strategies behavior
   */
  stopIfFailed?: null | boolean
}

/** Repeats with fixed interval */
export function repeatStrategyInterval({
  interval,
  stopIfFailed,
}: RepeatStrategyIntervalOptions): TaskRepeatStrategy {
  return function intervalStrategy(status) {
    if (stopIfFailed && status.lastFailedRuns) {
      return { stop: true }
    }

    return {
      stop: stopIfFailed == null ? null : false,
      delay: status => {
        if (stopIfFailed && status.lastFailedRuns) {
          return { stop: true }
        }
        return {
          stop: stopIfFailed == null ? null : false,
          delay: interval,
        }
      },
    }
  }
}
