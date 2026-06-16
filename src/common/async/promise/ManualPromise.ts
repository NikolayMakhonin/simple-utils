/** Promise with externally accessible resolve and reject */
export class ManualPromise<T = void> {
  readonly promise: Promise<T>
  readonly resolve: (value: T | PromiseLike<T>) => void
  readonly reject: (reason?: any) => void

  constructor() {
    let _resolve: (value: T | PromiseLike<T>) => void
    let _reject: (reason?: any) => void
    this.promise = new Promise<T>((resolve, reject) => {
      _resolve = resolve
      _reject = reject
    })
    this.resolve = _resolve!
    this.reject = _reject!
  }
}
