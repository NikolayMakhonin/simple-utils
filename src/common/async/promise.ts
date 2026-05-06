import type {
  PromiseLikeOrValue,
  PromiseOrValue,
} from 'src/common/types/common'

/**
 * Same as Promise.all but waits for all promises to settle
 * and throws if any promise is rejected.
 */
export async function promiseAllWait<T extends readonly unknown[] | []>(
  promises: T,
): Promise<{ -readonly [P in keyof T]: Awaited<T[P]> }> {
  const states = await Promise.allSettled(promises)
  const results: any[] = []
  states.forEach(state => {
    if (state.status === 'fulfilled') {
      results.push(state.value)
    } else {
      throw state.reason
    }
  })
  return results as any
}

export function isPromiseLike(obj: any): obj is PromiseLike<any> {
  if (
    obj != null &&
    typeof obj === 'object' &&
    typeof obj.then === 'function'
  ) {
    return true
  }
  return false
}

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
