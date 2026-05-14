import type { TaskRepeatStrategy } from './types'

export type RepeatStrategyIntervalOptions = {
  interval: number
  /**
   * stop repeating if last execution failed
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
      stop: false,
      delay: status => {
        if (stopIfFailed && status.lastFailedRuns) {
          return { stop: true }
        }
        return {
          stop: false,
          delay: interval,
        }
      },
    }
  }
}
