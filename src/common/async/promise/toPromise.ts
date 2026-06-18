import type { PromiseLikeOrValue } from 'src/common/types/common'
import { isPromiseLike } from './isPromiseLike'
import { promiseLikeToPromise } from './promiseLikeToPromise'

export function toPromise<T>(value: PromiseLikeOrValue<T>): Promise<T> {
  return isPromiseLike(value)
    ? promiseLikeToPromise(value)
    : Promise.resolve(value)
}
