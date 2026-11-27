import type { IAbortSignalFast } from '@flemist/abort-controller-fast'

export type AbortSignalToPromiseOptions = {
  dontThrow?: null | boolean
}

export function abortSignalToPromise(
  abortSignal: IAbortSignalFast | null | undefined,
  options?: null | AbortSignalToPromiseOptions,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    abortSignal?.subscribe(error => {
      if (options?.dontThrow) {
        resolve()
      } else {
        reject(error)
      }
    })
  })
}
