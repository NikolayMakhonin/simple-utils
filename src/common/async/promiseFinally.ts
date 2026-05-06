import { isPromiseLike } from './promise'
import type { PromiseLikeOrValue } from 'src/common/types/common'

export function promiseFinally<TPromise extends PromiseLike<any>>(
  promise: TPromise,
  onFinally: (() => PromiseLikeOrValue<void>) | null | undefined,
): TPromise {
  if (!onFinally) {
    return promise
  }

  return promise.then(
    result => {
      const voidOrPromise = onFinally()
      if (!isPromiseLike(voidOrPromise)) {
        return result
      }
      return voidOrPromise.then(() => result)
    },
    err => {
      const voidOrPromise = onFinally()
      if (!isPromiseLike(voidOrPromise)) {
        throw err
      }
      return voidOrPromise.then(() => {
        throw err
      })
    },
  ) as TPromise
}
