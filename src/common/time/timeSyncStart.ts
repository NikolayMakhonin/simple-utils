import { AbortControllerFast } from '@flemist/abort-controller-fast'
import type { TaskOptionsBase } from 'src/common/task/TaskBase'
import { createTaskRepeated } from 'src/common/task/TaskRepeated'
import type { Unsubscribe } from 'src/common/types'
import type { GetDateInetOptions } from './getDateInet'
import { getDateInetRange } from './getDateInetRange'
import { type NowReal, nowReal as nowRealDefault } from './now'

// An hour: between syncs nowReal.now() drifts by a fraction of a second per hour.
// That is less than the 1-second precision of internet time
const TIME_SYNC_INTERVAL = 60 * 60 * 1000

// A minute: when the page ends without being hidden, such as on a crash,
// the stored realDateMinimum lags the end of the page by at most a minute
const NOW_REAL_SAVE_INTERVAL = 60 * 1000

// A second: after a device clock set forward, nowReal.now() stays ahead
// for at most a second before a measurement starts
const NOW_REAL_CHECK_INTERVAL = 1000

/** The state that restores a NowReal after a restart */
export type TimeSyncStored = {
  offset: number
  realDateMinimum: number | null
}

export type TimeSyncStartOptions = {
  dateInetOptions?: null | Omit<GetDateInetOptions, 'abortSignal'>
  /** The widest accepted range of real time. A wider range still updates nowReal, and the measurement repeats */
  rangeWidthMaximum: number
  /** Returns the state that save kept, or null */
  load: () => TimeSyncStored | null
  /** Keeps the state for load to return after a restart */
  save: (stored: TimeSyncStored) => void
  /**
   * Called with null at start and after every successful measurement.
   * Called with the error of every failed measurement, also when its range is wider than rangeWidthMaximum
   */
  onUpdate?: null | ((error: unknown) => void)
  logFuncError?: TaskOptionsBase['logFuncError']
  /** Default: nowReal */
  nowReal?: null | NowReal
}

/**
 * Keeps nowReal on internet time,
 * and keeps its state across restarts through load and save
 */
export function timeSyncStart(options: TimeSyncStartOptions): Unsubscribe {
  const nowReal = options.nowReal ?? nowRealDefault
  const stored = options.load()
  if (stored != null) {
    nowReal.updateOffset(stored.offset, stored.realDateMinimum)
  }
  options.onUpdate?.(null)

  function saveNowReal() {
    const offset = nowReal.offset
    if (offset != null) {
      options.save({ offset, realDateMinimum: nowReal.realDateMinimum })
    }
  }

  let lastRangeWidth: number | null = null

  const timeSyncAbortController = new AbortControllerFast()

  const timeSyncTask = createTaskRepeated(
    async (_, { abortSignal }) => {
      try {
        const range = await getDateInetRange({
          ...options.dateInetOptions,
          abortSignal,
        })
        nowReal.updateRealDate(range)
        const rangeWidth = range[1] - range[0]
        lastRangeWidth = rangeWidth
        saveNowReal()
        // A wider range has still updated nowReal, and the throw makes the task measure again
        if (rangeWidth > options.rangeWidthMaximum) {
          throw new Error(
            `[timeSyncStart] range of internet time (${rangeWidth} ms) is wider than rangeWidthMaximum (${options.rangeWidthMaximum} ms)`,
          )
        }
        options.onUpdate?.(null)
      } catch (error) {
        if (!abortSignal.aborted) {
          options.onUpdate?.(error)
        }
        throw error
      }
    },
    null,
    {
      // Each attempt is a run of this task, never a retry inside a run (withRetry).
      // run() called during a run returns the promise of that run.
      // So syncTimeNow() could not cut short the wait between retries inside a run
      repeatStrategy: () => ({
        delay: status => {
          if (!status.lastFailedRuns) {
            return TIME_SYNC_INTERVAL
          }
          // The delay doubles from 1 second, for a short failure of the network, up to 10 seconds.
          // So the next measurement comes within 10 seconds after the network returns
          return Math.min(1000 * 2 ** (status.lastFailedRuns - 1), 10_000)
        },
      }),
      abortSignal: timeSyncAbortController.signal,
      logFuncError: options.logFuncError,
    },
  )

  void timeSyncTask.repeated.run()

  function syncTimeNow() {
    void timeSyncTask.repeated.run({ immediate: true })
  }

  const unsubscribes: Unsubscribe[] = [() => timeSyncAbortController.abort()]

  if (typeof document !== 'undefined') {
    function onVisibilityChange() {
      if (document.hidden) {
        saveNowReal()
      } else {
        syncTimeNow()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    unsubscribes.push(() => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
    })
  }

  if (typeof globalThis.addEventListener !== 'undefined') {
    globalThis.addEventListener('online', syncTimeNow)
    unsubscribes.push(() => {
      globalThis.removeEventListener('online', syncTimeNow)
    })
  }

  const nowRealSaveTimer = setInterval(saveNowReal, NOW_REAL_SAVE_INTERVAL)
  unsubscribes.push(() => {
    clearInterval(nowRealSaveTimer)
  })

  // After a sleep or a device clock set forward, Date.now() jumps ahead.
  // The next reading of nowReal.now() adds the jump.
  // A jump past the range of the last measurement can come from a wrong device clock.
  // Only a measurement tells it from a sleep
  const nowRealCheckTimer = setInterval(() => {
    const realDateMinimum = nowReal.realDateMinimum
    // After a failed measurement, the task repeats it after its own growing delay.
    // A measurement started here would cut that delay short.
    // The status of rerun counts every measurement. The status of repeated counts its whole loop as one run.
    // The + 1 allows for nowReal.now() and realDateMinimum each rounded down to whole milliseconds
    if (
      !timeSyncTask.rerun.status.lastFailedRuns &&
      lastRangeWidth != null &&
      realDateMinimum != null &&
      nowReal.now() - realDateMinimum > lastRangeWidth + 1
    ) {
      syncTimeNow()
    }
  }, NOW_REAL_CHECK_INTERVAL)
  unsubscribes.push(() => {
    clearInterval(nowRealCheckTimer)
  })

  return () => {
    for (let i = 0, len = unsubscribes.length; i < len; i++) {
      unsubscribes[i]()
    }
  }
}
