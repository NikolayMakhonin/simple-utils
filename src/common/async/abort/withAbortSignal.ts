import type { IAbortSignalFast } from '@flemist/abort-controller-fast'
import { isPromiseLike } from '../promise'

type WithAbortSignalOptions<T> = {
  func: (abortSignal: IAbortSignalFast | null | undefined) => T
  abortSignal: IAbortSignalFast | null | undefined
  onAbort?: null | ((reason: any) => void)
}

export function withAbortSignal<T>({
  func,
  abortSignal,
  onAbort,
}: WithAbortSignalOptions<T>): T extends PromiseLike<infer U> ? Promise<U> : T {
  if (abortSignal == null) {
    return func(abortSignal) as any
  }

  const unsubscribe = onAbort == null ? null : abortSignal.subscribe(onAbort)

  try {
    abortSignal.throwIfAborted()
    const resultOrPromise = func(abortSignal)
    if (isPromiseLike(resultOrPromise)) {
      return resultOrPromise.then(
        result => {
          unsubscribe?.()
          return result
        },
        error => {
          unsubscribe?.()
          throw error
        },
      ) as any
    }
    unsubscribe?.()
    return resultOrPromise as any
  } catch (error) {
    unsubscribe?.()
    throw error
  }
}
