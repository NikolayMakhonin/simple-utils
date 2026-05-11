import {
  AbortControllerReusable,
  type AbortControllerReusableOptions,
} from '../async'
import {
  type ITimeController,
  timeControllerDefault,
} from '@flemist/time-controller'
import type {
  ITaskStatus,
  SuccessPredicateResult,
  TaskStatusBase,
  TaskSuccessPredicate,
} from './types'
import { type ISubject, type Listener, Subject } from '../rx'
import type { Unsubscribe } from '../types'
import type { IAbortSignalFast } from '@flemist/abort-controller-fast'
import type { PromiseLikeOrValue } from '../types/common'

export interface ITaskStatusControllerBase<
  Result = void,
  Status extends TaskStatusBase<Result> = TaskStatusBase<Result>,
> extends ITaskStatus<Result, Status> {
  run(func: () => PromiseLikeOrValue<Result>): Promise<Result>
  abort(): void
  readonly abortSignal: IAbortSignalFast
  readonly timeController: ITimeController
}

export type TaskStatusControllerBaseOptions<Result = void> =
  AbortControllerReusableOptions & {
    timeController?: null | ITimeController
    successPredicate?: null | TaskSuccessPredicate<
      Result,
      TaskStatusBase<Result>
    >
  }

export function taskSuccessPredicateDefault<T>(
  status: TaskStatusBase<T>,
): true | SuccessPredicateResult {
  if (status.lastEnd != null && !status.lastHasError) {
    return true
  }
  return { reason: status.lastError }
}

export class TaskStatusControllerBase<
  Result = void,
  Status extends TaskStatusBase<Result> = TaskStatusBase<Result>,
> implements ITaskStatusControllerBase<Result, Status>
{
  private readonly _options:
    | undefined
    | null
    | TaskStatusControllerBaseOptions<Result>
  private readonly _abortController: AbortControllerReusable = null!
  private readonly _events: ISubject<Status>
  private readonly _timeController: ITimeController
  private _status: Status

  constructor(
    initialStatus: Omit<
      Status,
      | 'firstStart'
      | 'isRunning'
      | 'isAborted'
      | 'lastStart'
      | 'lastEnd'
      | 'lastSuccess'
      | 'lastFailed'
      | 'lastFailedReason'
      | 'lastHasError'
      | 'lastError'
      | 'lastResult'
      | 'lastSuccessRuns'
      | 'lastFailedRuns'
      | 'abortSignal'
      | 'timeController'
    >,
    options: undefined | null | TaskStatusControllerBaseOptions<Result>,
  ) {
    this._options = options
    this._abortController = new AbortControllerReusable(this._options)
    this._timeController =
      this._options?.timeController ?? timeControllerDefault
    this._status = {
      abortSignal: this._abortController.signal,
      timeController: this._timeController,
      firstStart: null,
      isRunning: false,
      isAborted: false,
      lastStart: null,
      lastEnd: null,
      lastSuccess: null,
      lastFailed: null,
      lastFailedReason: undefined,
      lastHasError: false,
      ...initialStatus,
    } as Status
    this._events = new Subject({
      emitLastEvent: true,
      hasLast: true,
      last: this._status,
    })
    this._abortController.subscribe(() => {
      this._events.emit(this._status)
    })
  }

  get status(): Status {
    return this._status
  }

  subscribe(listener: Listener<Status>): Unsubscribe {
    return this._events.subscribe(listener)
  }

  protected onStart(): void {
    const now = this._timeController.now()
    this._status = {
      ...this._status,
      abortSignal: this._abortController.signal,
      isRunning: true,
      isAborted: this._abortController.signal.aborted,
      firstStart: this._status.firstStart ?? now,
      lastStart: now,
    }
    this._events.emit(this._status)
  }

  protected onResult(result: Result): void {
    this._status = {
      ...this._status,
      isRunning: false,
      isAborted: this._abortController.signal.aborted,
      lastEnd: this._timeController.now(),
      lastHasError: false,
      lastError: undefined,
      lastResult: result,
    }
    this.applySuccessPredicate()
  }

  protected onError(error: any): void {
    this._status = {
      ...this._status,
      isRunning: false,
      isAborted: this._abortController.signal.aborted,
      lastEnd: this._timeController.now(),
      lastHasError: true,
      lastError: error,
      lastResult: undefined,
    }
    this.applySuccessPredicate()
  }

  protected applySuccessPredicate(): void {
    const successPredicate =
      this._options?.successPredicate ?? taskSuccessPredicateDefault
    const result = successPredicate(this._status)
    if (result === true || result.success === true) {
      this._status = {
        ...this._status,
        lastSuccess: this._status.lastEnd!,
        lastFailedReason: undefined,
        lastSuccessRuns: (this._status.lastSuccessRuns ?? 0) + 1,
        lastFailedRuns: 0,
      }
    } else {
      this._status = {
        ...this._status,
        lastFailed: this._status.lastEnd!,
        lastFailedReason: result.reason,
        lastSuccessRuns: 0,
        lastFailedRuns: (this._status.lastFailedRuns ?? 0) + 1,
      }
    }
    // Abort emits status event, so we don't need to emit it here
    this.abort()
  }

  async run(func: () => PromiseLikeOrValue<Result>): Promise<Result> {
    this.onStart()
    try {
      const result = await func()
      this.onResult(result)
      return result
    } catch (error) {
      this.onError(error)
      throw error
    }
  }

  abort(): void {
    this._abortController.abort()
  }

  get abortSignal(): IAbortSignalFast {
    return this._abortController.signal
  }

  get timeController(): ITimeController {
    return this._timeController
  }
}
