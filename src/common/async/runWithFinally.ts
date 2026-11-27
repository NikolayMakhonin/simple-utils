import { promiseFinally } from './promise/promiseFinally'
import type {
  PromiseLikeOrValue,
  PromiseOrValue,
} from 'src/common/types/common'
import { isPromiseLike } from './promise/isPromiseLike'
import { promiseLikeToPromise } from './promise/promiseLikeToPromise'

/**
 * Runs the code below as an async function would, but returns or throws without a promise
 * while init, func, and onFinally return no promise:
 * ```
 * const context = await init()
 * try {
 *   return await func(context)
 * } finally {
 *   await onFinally()
 * }
 * ```
 */
export function runWithFinally<Context, Result>(
  /** init executes outside of try-catch block without onFinally and returns context that will be passed to func */
  init: (() => PromiseLikeOrValue<Context>) | null | undefined,
  /** func executes in try-catch block and onFinally executes in finally block */
  func: (context: Context) => PromiseLike<Result>,
  onFinally: (() => PromiseLikeOrValue<void>) | null | undefined,
): Promise<Result>
export function runWithFinally<Context, Result>(
  /** init executes outside of try-catch block without onFinally and returns context that will be passed to func */
  init: () => PromiseLike<Context>,
  /** func executes in try-catch block and onFinally executes in finally block */
  func: (context: Context) => PromiseLikeOrValue<Result>,
  onFinally: (() => PromiseLikeOrValue<void>) | null | undefined,
): Promise<Result>
export function runWithFinally<Context, Result>(
  /** init executes outside of try-catch block without onFinally and returns context that will be passed to func */
  init: (() => PromiseLikeOrValue<Context>) | null | undefined,
  /** func executes in try-catch block and onFinally executes in finally block */
  func: (context: Context) => PromiseLikeOrValue<Result>,
  onFinally: (() => PromiseLikeOrValue<void>) | null | undefined,
): PromiseOrValue<Result>
export function runWithFinally<Context, Result>(
  /** init executes outside of try-catch block without onFinally and returns context that will be passed to func */
  init: (() => Context) | null | undefined,
  /** func executes in try-catch block and onFinally executes in finally block */
  func: (context: Context) => Result,
  onFinally: (() => void) | null | undefined,
): Result
export function runWithFinally<Context, Result>(
  /** init executes outside of try-catch block without onFinally and returns context that will be passed to func */
  init: (() => PromiseLikeOrValue<Context>) | null | undefined,
  /** func executes in try-catch block and onFinally executes in finally block */
  func: (context: Context) => PromiseLikeOrValue<Result>,
  onFinally: (() => PromiseLikeOrValue<void>) | null | undefined,
): PromiseOrValue<Result> {
  function _run(context: Context) {
    if (!onFinally) {
      return func(context)
    }

    let result: Result
    try {
      const resultOrPromise = func(context)
      if (isPromiseLike(resultOrPromise)) {
        return promiseFinally(resultOrPromise, onFinally)
      }
      result = resultOrPromise
    } catch (err) {
      const voidOrPromise = onFinally()
      if (!isPromiseLike(voidOrPromise)) {
        throw err
      }
      return voidOrPromise.then(() => {
        throw err
      })
    }

    // Called after the try, because the catch above would call onFinally
    // a second time for an error that onFinally throws
    const voidOrPromise = onFinally()
    if (!isPromiseLike(voidOrPromise)) {
      return result
    }
    return voidOrPromise.then(() => result)
  }

  const contextOrPromise = init ? init() : (void 0 as unknown as Context)
  if (!isPromiseLike(contextOrPromise)) {
    return promiseLikeToPromise(_run(contextOrPromise))
  }
  return promiseLikeToPromise(contextOrPromise.then(_run))
}
