export class ManualPromise<T = void> {
  readonly promise: Promise<T>
  readonly resolve: (value: T | PromiseLike<T>) => void
  readonly reject: (reason?: any) => void

  constructor() {
    let resolve: (value: T | PromiseLike<T>) => void
    let reject: (reason?: any) => void
    this.promise = new Promise<T>((res, rej) => {
      resolve = res
      reject = rej
    })
    this.resolve = resolve!
    this.reject = reject!
  }
}
