import { waitMicrotasks } from './waitMicrotasks'
import { type TimeControllerMock } from '@flemist/time-controller'
import type { IAbortSignalFast } from '@flemist/abort-controller-fast'
import { isPromiseLike } from 'src/common/async/promise'
import { promiseToAbortSignal } from 'src/common/async/abort/abort-controller-fast/abortSignalToPromise'
import { EMPTY_FUNC } from 'src/common/constants'

export type WaitTimeControllerMockOptions = {
  timeout?: null | number
  /**
   * - `number` - N `await Promise.resolve().then()` per iteration
   * - `null` - wait 1 macrotask per iteration
   */
  awaitsPerIteration?: null | number
}

export async function waitTimeControllerMock<T = any>(
  timeControllerMock: TimeControllerMock,
  abortSignalOrPromise: PromiseLike<T>,
  options?: null | WaitTimeControllerMockOptions,
): Promise<T>
export async function waitTimeControllerMock(
  timeControllerMock: TimeControllerMock,
  abortSignal?: null | IAbortSignalFast,
  options?: null | WaitTimeControllerMockOptions,
): Promise<void>
export async function waitTimeControllerMock<T = any>(
  timeControllerMock: TimeControllerMock,
  abortSignalOrPromise?: null | IAbortSignalFast | PromiseLike<T>,
  options?: null | WaitTimeControllerMockOptions,
): Promise<T | void> {
  let promise: PromiseLike<T> | null | undefined
  let abortSignal: IAbortSignalFast | null | undefined

  if (isPromiseLike(abortSignalOrPromise)) {
    promise = abortSignalOrPromise
    abortSignal = promiseToAbortSignal(promise)
  } else {
    promise = null
    abortSignal = abortSignalOrPromise
  }

  const endTime =
    options?.timeout == null ? null : timeControllerMock.now() + options.timeout
  while (true) {
    if (options?.awaitsPerIteration != null) {
      for (let i = 0, len = options.awaitsPerIteration; i < len; i++) {
        await Promise.resolve().then(EMPTY_FUNC)
        if (abortSignal?.aborted) {
          break
        }
      }
    } else {
      await waitMicrotasks(abortSignal).catch(EMPTY_FUNC)
    }
    if (abortSignal?.aborted) {
      break
    }
    if (endTime != null && timeControllerMock.now() >= endTime) {
      break
    }
    let nextTime = timeControllerMock.nextQueuedTime
    if (nextTime == null && !promise) {
      break
    }
    if (nextTime == null || (endTime != null && nextTime > endTime)) {
      nextTime = endTime
    }
    if (nextTime != null) {
      timeControllerMock.setTime(nextTime)
    }
  }

  return promise ?? void 0
}
