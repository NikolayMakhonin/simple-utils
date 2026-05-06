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
  private readonly _options: null | AbortControllerReusableOptions
  private readonly _events: ISubject<TAbortReason> = new Subject()
  private _abortController: IAbortControllerFast = null!
  private _abortSignal: IAbortSignalFast = null!

  constructor(options?: null | AbortControllerReusableOptions) {
    this._options = options ?? null
    this.resetAbortController()
  }

  private resetAbortController(): void {
    this._abortController = new AbortControllerFast()
    this._abortSignal = combineAbortSignals(
      this._abortController.signal,
      this._options?.abortSignal,
    )
    this._abortSignal.subscribe(reason => {
      this._events.emit(reason)
    })
  }

  abort(reason?: TAbortReason): void {
    if (this._options?.abortSignal?.aborted) {
      return
    }
    const abortController = this._abortController
    this.resetAbortController()
    abortController.abort(reason)
  }

  get signal(): IAbortSignalFast {
    return this._abortSignal
  }

  subscribe(callback: (reason: TAbortReason) => void): IUnsubscribe {
    if (this._abortSignal.aborted) {
      callback(this._abortSignal.reason)
    }
    return this._events.subscribe(callback)
  }
}
