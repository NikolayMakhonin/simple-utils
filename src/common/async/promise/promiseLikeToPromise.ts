import type {
  PromiseLikeOrValue,
  PromiseOrValue,
} from 'src/common/types/common'
import { isPromiseLike } from './isPromiseLike'

export function promiseLikeToPromise<T>(
  value: PromiseLike<T> | Promise<T>,
): Promise<T>
export function promiseLikeToPromise<T>(
  value: PromiseLikeOrValue<T> | PromiseOrValue<T>,
): PromiseOrValue<T>
export function promiseLikeToPromise<T>(value: T): T
export function promiseLikeToPromise<T>(
  value: PromiseLikeOrValue<T> | PromiseOrValue<T>,
): PromiseOrValue<T> {
  if (value instanceof Promise) {
    return value
  }
  if (isPromiseLike(value)) {
    return new Promise((resolve, reject) => {
      value.then(resolve, reject)
    })
  }
  return value
}
