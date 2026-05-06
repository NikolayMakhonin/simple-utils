import { promiseFinally } from './promise/promiseFinally'
import type { PromiseLikeOrValue } from 'src/common/types/common'
import { isPromiseLike } from './promise/isPromiseLike'

/** Optimized try finally with sync and async support:
const context = await init()
try {
  return await func(context)
} finally {
  await onFinally()
}
*/
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
  func: (context: Context) => PromiseLike<Result>,
  onFinally: (() => PromiseLikeOrValue<void>) | null | undefined,
): PromiseLike<Result>
export function runWithFinally<Context, Result>(
  /** init executes outside of try-catch block without onFinally and returns context that will be passed to func */
  init: () => PromiseLike<Context>,
  /** func executes in try-catch block and onFinally executes in finally block */
  func: (context: Context) => PromiseLikeOrValue<Result>,
  onFinally: (() => PromiseLikeOrValue<void>) | null | undefined,
): PromiseLike<Result>
export function runWithFinally<Context, Result>(
  /** init executes outside of try-catch block without onFinally and returns context that will be passed to func */
  init: (() => PromiseLikeOrValue<Context>) | null | undefined,
  /** func executes in try-catch block and onFinally executes in finally block */
  func: (context: Context) => PromiseLikeOrValue<Result>,
  onFinally: (() => PromiseLikeOrValue<void>) | null | undefined,
): PromiseLikeOrValue<Result>
export function runWithFinally<Context, Result>(
  /** init executes outside of try-catch block without onFinally and returns context that will be passed to func */
  init: (() => PromiseLikeOrValue<Context>) | null | undefined,
  /** func executes in try-catch block and onFinally executes in finally block */
  func: (context: Context) => PromiseLikeOrValue<Result>,
  onFinally: (() => PromiseLikeOrValue<void>) | null | undefined,
): PromiseLikeOrValue<Result> {
  function _run(context: Context) {
    if (!onFinally) {
      return func(context)
    }

    try {
      const resultOrPromise = func(context)
      if (!isPromiseLike(resultOrPromise)) {
        const voidOrPromise = onFinally()
        if (!isPromiseLike(voidOrPromise)) {
          return resultOrPromise
        }
        return voidOrPromise.then(() => resultOrPromise)
      }
      return promiseFinally(resultOrPromise, onFinally)
    } catch (err) {
      const voidOrPromise = onFinally()
      if (!isPromiseLike(voidOrPromise)) {
        throw err
      }
      return voidOrPromise.then(() => {
        throw err
      })
    }
  }

  const contextOrPromise = init ? init() : (void 0 as unknown as Context)
  if (!isPromiseLike(contextOrPromise)) {
    return _run(contextOrPromise)
  }
  return contextOrPromise.then(_run)
}
