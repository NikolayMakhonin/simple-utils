import { waitMicrotasks } from './waitMicrotasks'
import { type TimeMock } from 'src/common/time/time'
import type { IAbortSignalFast } from '@flemist/abort-controller-fast'
import { promiseToAbortSignal } from 'src/common/async/abort/abortSignalToPromise'
import { EMPTY_FUNC } from 'src/common/constants'
import { isPromiseLike } from 'src/common/async/promise/isPromiseLike'

export type WaitTimeMockOptions = {
  timeout?: null | number
  /**
   * - `number` - N `await Promise.resolve().then()` per iteration
   * - `null` - wait 1 macrotask per iteration
   */
  awaitsPerIteration?: null | number
}

export async function waitTimeMock<T = any>(
  timeMock: TimeMock,
  abortSignalOrPromise: PromiseLike<T>,
  options?: null | WaitTimeMockOptions,
): Promise<T>
export async function waitTimeMock(
  timeMock: TimeMock,
  abortSignal?: null | IAbortSignalFast,
  options?: null | WaitTimeMockOptions,
): Promise<void>
export async function waitTimeMock<T = any>(
  timeMock: TimeMock,
  abortSignalOrPromise?: null | IAbortSignalFast | PromiseLike<T>,
  options?: null | WaitTimeMockOptions,
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

  const timeEnd =
    options?.timeout == null ? null : timeMock.time() + options.timeout
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
    if (timeEnd != null && timeMock.time() >= timeEnd) {
      break
    }
    let timeNext = timeMock.timeNextQueued
    if (timeNext == null && !promise) {
      break
    }
    if (timeNext == null || (timeEnd != null && timeNext > timeEnd)) {
      timeNext = timeEnd
    }
    if (timeNext != null) {
      timeMock.setTime(timeNext)
    }
  }

  return promise ?? void 0
}
