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
  readonly #options: null | TaskOptionsBase<Result>
  readonly #func: TaskFunc<Args, Result>
  readonly #wait: () => Promise<void>
  readonly #statusController: TaskStatusControllerBase<
    Result,
    TaskStatusBase<Result>
  >
  #args: Args
  #runPromise: Promise<Result> | null = null

  constructor(
    func: TaskFunc<Args, Result>,
    args: Args,
    options?: null | TaskOptionsBase<Result>,
  ) {
    this.#options = options ?? null
    this.#func = func
    this.#args = args
    this.#wait = () => this.wait()
    this.#statusController = new TaskStatusControllerBase<
      Result,
      TaskStatusBase<Result>
    >({}, this.#options)
  }

  get args(): Args {
    return this.#args
  }

  set args(value: Args) {
    this.#args = value
  }

  get status(): TaskStatusBase<Result> {
    return this.#statusController.status
  }

  abort(reason?: any): void {
    this.#statusController.abort(reason)
  }

  subscribe(listener: Listener<TaskStatusBase<Result>>): Unsubscribe {
    return this.#statusController.subscribe(listener)
  }

  private logError(error: any): void {
    if (
      this.#options?.logLevel == null ||
      this.#options.logLevel >= LogLevel.error
    ) {
      console.error('[TaskBase]', error)
    }
  }

  run(options?: null | RunOptions): Promise<Result> {
    this.#statusController.abortSignal.throwIfAborted()
    if (this.#runPromise) {
      return this.#runPromise
    }

    const isFirst = this.#statusController.status.firstStart == null

    const resultOrPromise = this.#statusController.run(() =>
      this.#func(this.#args, {
        abortSignal: this.#statusController.abortSignal,
        timeController: this.#statusController.timeController,
        isFirst,
      }),
    )

    this.#runPromise = promiseLikeToPromise(
      resultOrPromise.then(
        result => {
          this.#runPromise = null
          return result
        },
        error => {
          this.#runPromise = null
          this.logError(error)
          throw error
        },
      ),
    )

    // Suppress unhandled rejection when error logging is disabled
    if (
      this.#options?.logLevel != null &&
      this.#options.logLevel < LogLevel.error
    ) {
      this.#runPromise.catch(EMPTY_FUNC)
    }

    return this.#runPromise
  }

  wait(): Promise<void> {
    return this.#runPromise?.then(EMPTY_FUNC, EMPTY_FUNC) ?? Promise.resolve()
  }

  waitIdle(): Promise<void> {
    if (this.#runPromise) {
      return this.#runPromise.then(this.#wait, this.#wait)
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
