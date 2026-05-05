import type { IAbortSignalFast } from '@flemist/abort-controller-fast'
import { type ISubject, type Listener, Subject } from 'src/common/rx'
import {
  type ITimeController,
  timeControllerDefault,
} from '@flemist/time-controller'
import {
  EMPTY_FUNC,
  isPromiseLike,
  promiseLikeToPromise,
  type PromiseOrValue,
} from '@flemist/async-utils'
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
  private readonly _events: ISubject<Status> = new Subject()
  private readonly _abortController: AbortControllerReusable = null!
  private readonly _timeController: ITimeController
  private readonly _wait: () => PromiseOrValue<void>
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
      lastStart: null,
      lastEnd: null,
      lastSuccess: null,
      lastHasError: false,
    } as Status
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

  private onStart(options: undefined | null | RunOptions): void {
    const now = this._timeController.now()
    this._status = {
      ...this._status,
      isRunning: true,
      countRetry:
        options?.isRetry == null
          ? null
          : this._status.countRetry == null
            ? 0
            : this._status.countRetry + 1,
      firstStart: this._status.firstStart ?? now,
      lastStart: now,
      abortSignal: this._abortController.signal,
    }
    this._events.emit(this._status)
  }

  private onSuccess(result: Result): void {
    const now = this.timeController.now()
    this._status = {
      ...this._status,
      isRunning: false,
      lastEnd: now,
      lastHasError: false,
      lastError: undefined,
      lastResult: result,
    }

    const successPredicate =
      this._options?.successPredicate ?? taskSuccessPredicateDefault
    if (successPredicate(this._status)) {
      this._status = {
        ...this._status,
        lastSuccess: now,
      }
    }

    this._events.emit(this._status)
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
      lastEnd: this.timeController.now(),
      lastHasError: true,
      lastError: error,
      lastResult: undefined,
    }
    this._events.emit(this._status)
  }

  run(options?: null | RunOptions): PromiseOrValue<Result> {
    this._abortController.signal.throwIfAborted()
    if (this._runPromise) {
      return this._runPromise
    }

    const isFirst = this._status.firstStart == null
    this.onStart(options)
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
              this.onSuccess(result)
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
      this.onSuccess(resultOrPromise)
      return resultOrPromise
    } catch (error) {
      this.onError(error)
      throw error
    }
  }

  wait(): PromiseOrValue<void> {
    return this._runPromise?.then(EMPTY_FUNC, EMPTY_FUNC)
  }

  waitIdle(): PromiseOrValue<void> {
    if (this._runPromise) {
      return this._runPromise.then(this._wait, this._wait)
    }
  }
}

export function createTask<Args = ArgsDefault, Result = void>(
  func: TaskFunc<Args, Result>,
  args: Args,
  options?: null | TaskOptionsBase,
): TaskBase<Args, Result> {
  return new TaskBase(func, args, options)
}
