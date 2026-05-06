import type { IAbortSignalFast } from '@flemist/abort-controller-fast'
import { type ISubject, type Listener, Subject } from 'src/common/rx'
import {
  type ITimeController,
  timeControllerDefault,
} from '@flemist/time-controller'
import { EMPTY_FUNC } from 'src/common/constants'
import { promiseLikeToPromise } from 'src/common/async/promise/promiseLikeToPromise'
import type { Unsubscribe } from 'src/common/types'
import { LogLevel } from 'src/common/debug'
import {
  type ArgsDefault,
  type ITaskBaseWithArgs,
  type TaskFunc,
  type TaskRunOptionsBase,
  type TaskStatusBase,
} from './types'
import {
  AbortControllerReusable,
  type AbortControllerReusableOptions,
} from 'src/common/async/abort/AbortControllerReusable'
import { isPromiseLike } from 'src/common/async/promise/isPromiseLike'

export function taskSuccessPredicateDefault<T>(
  status: TaskStatusBase<T>,
): boolean {
  return status.lastEnd != null && !status.lastHasError
}

export type TaskOptionsBase = AbortControllerReusableOptions & {
  readonly timeController?: null | ITimeController
  readonly logLevel?: null | LogLevel
  readonly successPredicate?: null | ((status: TaskStatusBase<any>) => boolean)
}

export class TaskBase<
  Args = ArgsDefault,
  Result = void,
  RunOptions extends TaskRunOptionsBase = TaskRunOptionsBase,
  Status extends TaskStatusBase<Result> = TaskStatusBase<Result>,
> implements ITaskBaseWithArgs<Args, Result, RunOptions, Status>
{
  private readonly _options: null | TaskOptionsBase
  private readonly _func: TaskFunc<Args, Result>
  private readonly _events: ISubject<Status>
  private readonly _abortController: AbortControllerReusable = null!
  private readonly _timeController: ITimeController
  private readonly _wait: () => Promise<void>
  private _args: Args
  private _status: Status
  private _runPromise: Promise<Result> | null = null

  constructor(
    func: TaskFunc<Args, Result>,
    args: Args,
    options?: null | TaskOptionsBase,
  ) {
    this._options = options ?? null
    this._func = func
    this._args = args
    this._abortController = new AbortControllerReusable(this._options)
    this._timeController =
      this._options?.timeController ?? timeControllerDefault
    this._wait = () => this.wait()
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
      lastHasError: false,
    } as Status
    this._events = new Subject<Status>({
      emitLastEvent: true,
      hasLast: true,
      last: this._status,
    })
    this._abortController.subscribe(() => {
      this._events.emit(this._status)
    })
  }

  get args(): Args {
    return this._args
  }

  set args(value: Args) {
    this._args = value
  }

  get status(): Status {
    return this._status
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

  subscribe(listener: Listener<Status>): Unsubscribe {
    return this._events.subscribe(listener)
  }

  private onStart(): void {
    const now = this._timeController.now()
    this._status = {
      ...this._status,
      isRunning: true,
      isAborted: this._abortController.signal.aborted,
      firstStart: this._status.firstStart ?? now,
      lastStart: now,
      abortSignal: this._abortController.signal,
    }
    this._events.emit(this._status)
  }

  private onResult(result: Result): void {
    this._status = {
      ...this._status,
      isRunning: false,
      isAborted: this._abortController.signal.aborted,
      lastEnd: this.timeController.now(),
      lastHasError: false,
      lastError: undefined,
      lastResult: result,
    }
    this.applySuccessPredicate()
  }

  private onError(error: any): void {
    if (
      this._options?.logLevel == null ||
      this._options.logLevel >= LogLevel.error
    ) {
      console.error('[TaskBase]', error)
    }
    this._status = {
      ...this._status,
      isRunning: false,
      isAborted: this._abortController.signal.aborted,
      lastEnd: this.timeController.now(),
      lastHasError: true,
      lastError: error,
      lastResult: undefined,
    }
    this.applySuccessPredicate()
  }

  private applySuccessPredicate(): void {
    const successPredicate =
      this._options?.successPredicate ?? taskSuccessPredicateDefault
    if (successPredicate(this._status)) {
      this._status = {
        ...this._status,
        lastSuccess: this._status.lastEnd!,
        lastSuccessRuns: (this._status.lastSuccessRuns ?? 0) + 1,
        lastFailedRuns: 0,
      }
    } else {
      this._status = {
        ...this._status,
        lastFailed: this._status.lastEnd!,
        lastSuccessRuns: 0,
        lastFailedRuns: (this._status.lastFailedRuns ?? 0) + 1,
      }
    }
    // Abort emits status event, so we don't need to emit it here
    this.abort()
  }

  run(options?: null | RunOptions): Promise<Result> {
    this._abortController.signal.throwIfAborted()
    if (this._runPromise) {
      return this._runPromise
    }

    const isFirst = this._status.firstStart == null
    this.onStart()
    try {
      const resultOrPromise = this._func(this._args, {
        abortSignal: this._abortController.signal,
        timeController: this.timeController,
        isFirst,
      })
      if (isPromiseLike(resultOrPromise)) {
        this._runPromise = promiseLikeToPromise(
          resultOrPromise.then(
            result => {
              this._runPromise = null
              this.onResult(result)
              return result
            },
            error => {
              this._runPromise = null
              this.onError(error)
              throw error
            },
          ),
        )
        return this._runPromise
      }
      this.onResult(resultOrPromise)
      return Promise.resolve(resultOrPromise)
    } catch (error) {
      this.onError(error)
      return Promise.reject(error)
    }
  }

  wait(): Promise<void> {
    return this._runPromise?.then(EMPTY_FUNC, EMPTY_FUNC) ?? Promise.resolve()
  }

  waitIdle(): Promise<void> {
    if (this._runPromise) {
      return this._runPromise.then(this._wait, this._wait)
    }
    return Promise.resolve()
  }
}

export function createTask<Args = ArgsDefault, Result = void>(
  func: TaskFunc<Args, Result>,
  args: Args,
  options?: null | TaskOptionsBase,
): TaskBase<Args, Result> {
  return new TaskBase(func, args, options)
}
