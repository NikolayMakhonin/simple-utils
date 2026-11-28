import type {
  TaskRepeatStrategy,
  TaskRepeatStrategyAfter,
  TaskRepeatStrategyDelay,
  TaskStatusBase,
} from './types'
import type { PromiseLikeOrValue } from 'src/common/types/common'

/**
 * Merges multiple repeat strategies into one applying sequentially
 * Non-null values from later strategies overwrite earlier
 * Delay functions start at the same time
 * The merged delay waits for all of them, or rejects with the first error of one of them
 */
export function mergeRepeatStrategies<
  Result = any,
  Status extends TaskStatusBase<Result> = TaskStatusBase<Result>,
>(
  ...strategies: (TaskRepeatStrategy<Result, Status> | null | undefined)[]
): TaskRepeatStrategy<Result, Status> {
  return function merged(status) {
    let stop: boolean | null | undefined
    let stopReason: any
    let skipRun: boolean | null | undefined
    const delays: (number | TaskRepeatStrategyDelay<Result, Status>)[] = []

    for (let i = 0, len = strategies.length; i < len; i++) {
      const strategy = strategies[i]
      if (strategy == null) {
        continue
      }
      const strategyResult = strategy(status)
      if (strategyResult == null) {
        continue
      }

      if (strategyResult.stop != null) {
        stop = strategyResult.stop
        stopReason = strategyResult.stopReason
      }
      if (strategyResult.skipRun != null) {
        skipRun = strategyResult.skipRun
      }
      if (strategyResult.delay != null) {
        delays.push(strategyResult.delay)
      }
    }

    if (stop == null && skipRun == null && delays.length === 0) {
      return undefined
    }

    if (stop) {
      return { stop, stopReason }
    }

    if (delays.length === 0) {
      return { stop, skipRun }
    }

    return {
      stop,
      skipRun,
      delay: mergeDelays<Result, Status>(delays),
    }
  }
}

function mergeDelays<
  Result = any,
  Status extends TaskStatusBase<Result> = TaskStatusBase<Result>,
>(
  delays: (number | TaskRepeatStrategyDelay<Result, Status>)[],
): number | TaskRepeatStrategyDelay<Result, Status> {
  if (delays.length === 1) {
    return delays[0]
  }

  return async function mergedDelay(status, delayAbortSignal) {
    const promises: PromiseLikeOrValue<
      void | undefined | null | number | TaskRepeatStrategyAfter
    >[] = []

    for (let i = 0, len = delays.length; i < len; i++) {
      const _delay = delays[i]
      if (typeof _delay === 'function') {
        try {
          promises.push(_delay(status, delayAbortSignal))
        } catch (error) {
          // A throw would leave the promises of the delay functions
          // started before this one without a handler.
          // Such a promise can reject when the caller aborts delayAbortSignal.
          // Promise.all below handles them together with this error
          promises.push(Promise.reject(error))
          break
        }
      } else {
        promises.push(_delay)
      }
    }

    const results = await Promise.all(promises)

    let resultStop: boolean | null | undefined
    let resultStopReason: any
    let resultDelay: number | null | undefined

    for (let i = 0, len = results.length; i < len; i++) {
      const result = results[i]
      if (result == null) {
        continue
      }
      if (typeof result === 'number') {
        resultDelay = result
      } else {
        if (result.stop != null) {
          resultStop = result.stop
          resultStopReason = result.stopReason
        }
        if (result.delay != null) {
          resultDelay = result.delay
        }
      }
    }

    if (resultStop) {
      return { stop: resultStop, stopReason: resultStopReason }
    }

    if (resultStop == null && resultDelay == null) {
      return undefined
    }

    return {
      stop: resultStop,
      stopReason: resultStopReason,
      delay: resultDelay,
    }
  }
}
