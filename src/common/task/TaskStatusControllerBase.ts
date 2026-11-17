import {
  AbortControllerReusable,
  type AbortControllerReusableOptions,
} from '../async/abort/AbortControllerReusable'
import { type IDateTime, dateTimeReal } from 'src/common/time/date-time'
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
  abort(reason?: any): void
  readonly abortSignal: IAbortSignalFast
  readonly dateTime: IDateTime
}

export type TaskStatusControllerBaseOptions<Result = void> =
  AbortControllerReusableOptions & {
    dateTime?: null | IDateTime
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
  readonly #options: undefined | null | TaskStatusControllerBaseOptions<Result>
  readonly #abortController: AbortControllerReusable = null!
  readonly #events: ISubject<Status>
  readonly #dateTime: IDateTime
  #status: Status

  constructor(
    initialStatus: Omit<
      Status,
      | 'firstStart'
      | 'isRunning'
      | 'isAborted'
      | 'lastStartCompleted'
      | 'lastStart'
      | 'lastEnd'
      | 'lastSuccess'
      | 'lastFailed'
      | 'lastFailedReason'
      | 'lastHasError'
      | 'totalStarts'
      | 'lastError'
      | 'lastResult'
      | 'lastSuccessRuns'
      | 'lastFailedRuns'
      | 'abortSignal'
      | 'dateTime'
    >,
    options: undefined | null | TaskStatusControllerBaseOptions<Result>,
  ) {
    this.#options = options
    this.#abortController = new AbortControllerReusable(this.#options)
    this.#dateTime = this.#options?.dateTime ?? dateTimeReal
    this.#status = {
      abortSignal: this.#abortController.signal,
      dateTime: this.#dateTime,
      firstStart: null,
      isRunning: false,
      isAborted: false,
      lastStartCompleted: null,
      lastStart: null,
      lastEnd: null,
      lastSuccess: null,
      lastFailed: null,
      lastFailedReason: undefined,
      lastHasError: false,
      totalStarts: 0,
      ...initialStatus,
    } as Status
    this.#events = new Subject({
      emitLastEvent: true,
      hasLast: true,
      last: this.#status,
    })
    this.#abortController.subscribe(() => {
      this.#events.emit(this.#status)
    })
  }

  get status(): Status {
    return this.#status
  }

  subscribe(listener: Listener<Status>): Unsubscribe {
    return this.#events.subscribe(listener)
  }

  protected onStart(): void {
    const time = this.#dateTime.time.time()
    this.#status = {
      ...this.#status,
      abortSignal: this.#abortController.signal,
      isRunning: true,
      isAborted: this.#abortController.signal.aborted,
      firstStart: this.#status.firstStart ?? time,
      lastStart: time,
      totalStarts: this.#status.totalStarts + 1,
    }
    this.#events.emit(this.#status)
  }

  protected onResult(result: Result): void {
    this.#status = {
      ...this.#status,
      isRunning: false,
      isAborted: this.#abortController.signal.aborted,
      lastStartCompleted: this.#status.lastStart,
      lastEnd: this.#dateTime.time.time(),
      lastHasError: false,
      lastError: undefined,
      lastResult: result,
    }
    this.applySuccessPredicate()
  }

  protected onError(error: any): void {
    this.#status = {
      ...this.#status,
      isRunning: false,
      isAborted: this.#abortController.signal.aborted,
      lastStartCompleted: this.#status.lastStart,
      lastEnd: this.#dateTime.time.time(),
      lastHasError: true,
      lastError: error,
      lastResult: undefined,
    }
    this.applySuccessPredicate()
  }

  protected applySuccessPredicate(): void {
    const successPredicate =
      this.#options?.successPredicate ?? taskSuccessPredicateDefault
    const result = successPredicate(this.#status)
    if (result === true || result.success === true) {
      this.#status = {
        ...this.#status,
        lastSuccess: this.#status.lastEnd!,
        lastFailedReason: undefined,
        lastSuccessRuns: (this.#status.lastSuccessRuns ?? 0) + 1,
        lastFailedRuns: 0,
      }
    } else {
      this.#status = {
        ...this.#status,
        lastFailed: this.#status.lastEnd!,
        lastFailedReason: result.reason,
        lastSuccessRuns: 0,
        lastFailedRuns: (this.#status.lastFailedRuns ?? 0) + 1,
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

  abort(reason?: any): void {
    this.#abortController.abort(reason)
  }

  get abortSignal(): IAbortSignalFast {
    return this.#abortController.signal
  }

  get dateTime(): IDateTime {
    return this.#dateTime
  }
}
