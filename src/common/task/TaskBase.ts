import { type Listener } from 'src/common/rx'
import type { ITimeController } from '@flemist/time-controller'
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
  type TaskSuccessPredicate,
} from './types'
import { type AbortControllerReusableOptions } from 'src/common/async/abort/AbortControllerReusable'
import { TaskStatusControllerBase } from './TaskStatusControllerBase'

export type TaskOptionsBase<Result = void> = AbortControllerReusableOptions & {
  readonly timeController?: null | ITimeController
  readonly logLevel?: null | LogLevel
  readonly successPredicate?: null | TaskSuccessPredicate<
    Result,
    TaskStatusBase<Result>
  >
}

export class TaskBase<
  Args = ArgsDefault,
  Result = void,
  RunOptions extends TaskRunOptionsBase = TaskRunOptionsBase,
> implements ITaskBaseWithArgs<Args, Result, RunOptions, TaskStatusBase<Result>>
{
  private readonly _options: null | TaskOptionsBase<Result>
  private readonly _func: TaskFunc<Args, Result>
  private readonly _wait: () => Promise<void>
  private readonly _statusController: TaskStatusControllerBase<
    Result,
    TaskStatusBase<Result>
  >
  private _args: Args
  private _runPromise: Promise<Result> | null = null

  constructor(
    func: TaskFunc<Args, Result>,
    args: Args,
    options?: null | TaskOptionsBase<Result>,
  ) {
    this._options = options ?? null
    this._func = func
    this._args = args
    this._wait = () => this.wait()
    this._statusController = new TaskStatusControllerBase<
      Result,
      TaskStatusBase<Result>
    >({}, this._options)
  }

  get args(): Args {
    return this._args
  }

  set args(value: Args) {
    this._args = value
  }

  get status(): TaskStatusBase<Result> {
    return this._statusController.status
  }

  abort(reason?: any): void {
    this._statusController.abort(reason)
  }

  subscribe(listener: Listener<TaskStatusBase<Result>>): Unsubscribe {
    return this._statusController.subscribe(listener)
  }

  private logError(error: any): void {
    if (
      this._options?.logLevel == null ||
      this._options.logLevel >= LogLevel.error
    ) {
      console.error('[TaskBase]', error)
    }
  }

  run(options?: null | RunOptions): Promise<Result> {
    this._statusController.abortSignal.throwIfAborted()
    if (this._runPromise) {
      return this._runPromise
    }

    const isFirst = this._statusController.status.firstStart == null

    const resultOrPromise = this._statusController.run(() =>
      this._func(this._args, {
        abortSignal: this._statusController.abortSignal,
        timeController: this._statusController.timeController,
        isFirst,
      }),
    )

    this._runPromise = promiseLikeToPromise(
      resultOrPromise.then(
        result => {
          this._runPromise = null
          return result
        },
        error => {
          this._runPromise = null
          this.logError(error)
          throw error
        },
      ),
    )

    // Suppress unhandled rejection when error logging is disabled
    if (
      this._options?.logLevel != null &&
      this._options.logLevel < LogLevel.error
    ) {
      this._runPromise.catch(EMPTY_FUNC)
    }

    return this._runPromise
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
  options?: null | TaskOptionsBase<Result>,
): TaskBase<Args, Result> {
  return new TaskBase(func, args, options)
}
