import {
  AbortControllerFast,
  type IAbortControllerFast,
  type IAbortSignalFast,
} from '@flemist/abort-controller-fast'
import { combineAbortSignals } from './combineAbortSignals'
import type {
  IUnsubscribe,
  TAbortReason,
} from '@flemist/abort-controller-fast/dist/lib/contracts'
import { type IObservable, type ISubject, Subject } from 'src/common/rx'

export type AbortControllerReusableOptions = {
  /** Global abort signal */
  abortSignal?: null | IAbortSignalFast
}

/**
 * Reusable abort controller that creates a new abort signal after each abort
 */
export class AbortControllerReusable
  implements IAbortControllerFast, IObservable<TAbortReason>
{
  readonly #options: null | AbortControllerReusableOptions
  readonly #events: ISubject<TAbortReason> = new Subject()
  #abortController: IAbortControllerFast = null!
  #abortSignal: IAbortSignalFast = null!

  constructor(options?: null | AbortControllerReusableOptions) {
    this.#options = options ?? null
    this.resetAbortController()
  }

  private resetAbortController(): void {
    this.#abortController = new AbortControllerFast()
    this.#abortSignal = combineAbortSignals(
      this.#abortController.signal,
      this.#options?.abortSignal,
    )
    this.#abortSignal.subscribe(reason => {
      this.#events.emit(reason)
    })
  }

  abort(reason?: TAbortReason): void {
    if (this.#options?.abortSignal?.aborted) {
      return
    }
    const abortController = this.#abortController
    this.resetAbortController()
    abortController.abort(reason)
  }

  get signal(): IAbortSignalFast {
    return this.#abortSignal
  }

  subscribe(callback: (reason: TAbortReason) => void): IUnsubscribe {
    if (this.#abortSignal.aborted) {
      callback(this.#abortSignal.reason)
    }
    return this.#events.subscribe(callback)
  }
}
