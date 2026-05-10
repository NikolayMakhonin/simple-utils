import type {
  TaskRepeatStrategy,
  TaskRepeatStrategyBefore,
  TaskStatusBase,
} from './types'

/**
 * Merges multiple repeat strategies into one applying consequently
 * Not null/undefined values overwrite previous values
 */
export function mergeRepeatStrategies<
  Result = any,
  Status extends TaskStatusBase<Result> = TaskStatusBase<Result>,
>(
  ...strategies: TaskRepeatStrategy<Result, Status>[]
): TaskRepeatStrategy<Result, Status> {
  return function merged(status) {
    let result: TaskRepeatStrategyBefore<Result, Status> | undefined

    for (let i = 0, len = strategies.length; i < len; i++) {
      const strategyResult = strategies[i](status)
      if (strategyResult == null) {
        continue
      }

      if (result == null) {
        result = strategyResult
        continue
      }

      result = {
        stop: strategyResult.stop ?? result.stop,
        skipRun: strategyResult.skipRun ?? result.skipRun,
        delay: strategyResult.delay ?? result.delay,
      }
    }

    return result
  }
}
