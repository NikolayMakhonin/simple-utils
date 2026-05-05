import {
  EMPTY_FUNC,
  isPromiseLike,
  promiseLikeToPromise,
  type PromiseOrValue,
} from '@flemist/async-utils'
import {
  type ArgsDefault,
  type ITaskBaseWithArgs,
  type TaskFunc,
  type TaskRunOptionsBase,
  type TaskStatusBase,
} from './types'
import { TaskBase, type TaskOptionsBase } from './TaskBase'
import { type ITaskWrapperSource, TaskWrapper } from './TaskWrapper'

export type ITaskWithRetry<
  Args = ArgsDefault,
  Result = void,
  RunOptions extends TaskRunOptionsBase = TaskRunOptionsBase,
  Status extends TaskStatusBase<Result> = TaskStatusBase<Result>,
> = ITaskBaseWithArgs<Args, Result, RunOptions, Status>

export class TaskWithRetry<
    Args = ArgsDefault,
    Result = void,
    RunOptions extends TaskRunOptionsBase = TaskRunOptionsBase,
    Status extends TaskStatusBase<Result> = TaskStatusBase<Result>,
  >
  extends TaskWrapper<Args, Result, RunOptions, Status>
  implements ITaskWithRetry<Args, Result, RunOptions, Status>
{
  private readonly _wait: () => PromiseOrValue<void>
  private _runPromise: Promise<Result> | null = null

  constructor(task: ITaskWrapperSource<Args, Result, RunOptions, Status>) {
    super(task)
    this._wait = () => this.wait()
  }

  private _run(options?: null | RunOptions): PromiseOrValue<Result> {
    while (true) {
      this.abortSignal.throwIfAborted()

      try {
        const promiseOrResult = super.run(options)

        if (isPromiseLike(promiseOrResult)) {
          return promiseOrResult.then(
            result => {
              this.status.abortSignal.throwIfAborted()
              if (this.status.lastSuccessRuns === 0) {
                return result
              }
              return this._run(options)
            },
            error => {
              this.status.abortSignal.throwIfAborted()
              if (this.status.lastSuccessRuns === 0) {
                throw error
              }
              return this._run(options)
            },
          )
        }

        this.status.abortSignal.throwIfAborted()
        if (this.status.lastSuccessRuns === 0) {
          return promiseOrResult
        }
      } catch (error) {
        this.status.abortSignal.throwIfAborted()
        if (this.status.lastSuccessRuns === 0) {
          throw error
        }
      }
    }
  }

  run(options?: null | RunOptions): PromiseOrValue<Result> {
    this.abortSignal.throwIfAborted()
    if (this._runPromise) {
      return this._runPromise
    }

    const promiseOrResult = this._run(options)

    if (!isPromiseLike(promiseOrResult)) {
      return promiseOrResult
    }

    const runPromise = promiseOrResult.finally(() => {
      if (runPromise === this._runPromise) {
        this._runPromise = null
      }
    })
    this._runPromise = runPromise

    return this._runPromise
  }

  wait(): PromiseOrValue<void> {
    return this._runPromise?.then(EMPTY_FUNC, EMPTY_FUNC) ?? super.wait()
  }

  waitIdle(): PromiseOrValue<void> {
    if (this._runPromise) {
      return this._runPromise.then(this._wait, this._wait)
    }
    const promiseOrResult = super.wait()
    if (isPromiseLike(promiseOrResult)) {
      return promiseLikeToPromise(promiseOrResult).then(this._wait)
    }
  }
}

export function createTaskRetry<
  Args = ArgsDefault,
  Result = void,
  RunOptions extends TaskRunOptionsBase = TaskRunOptionsBase,
  Status extends TaskStatusBase<Result> = TaskStatusBase<Result>,
>(
  task: ITaskWrapperSource<Args, Result, RunOptions, Status>,
): ITaskWithRetry<Args, Result, RunOptions, Status>
export function createTaskRetry<Args = ArgsDefault, Result = void>(
  func: TaskFunc<Args, Result>,
  args: Args,
  options?: null | TaskOptionsBase,
): ITaskWithRetry<Args, Result>
export function createTaskRetry<
  Args = ArgsDefault,
  Result = void,
  RunOptions extends TaskRunOptionsBase = TaskRunOptionsBase,
  Status extends TaskStatusBase<Result> = TaskStatusBase<Result>,
>(
  taskOrFunc:
    | ITaskWrapperSource<Args, Result, RunOptions, Status>
    | TaskFunc<Args, Result>,
  argsOrOptions?: Args | (null | TaskOptionsBase),
  optionsArg?: null | TaskOptionsBase,
): ITaskWithRetry<Args, Result, RunOptions, Status> {
  if (typeof taskOrFunc === 'function') {
    return new TaskWithRetry(
      new TaskBase(taskOrFunc, argsOrOptions as Args, optionsArg),
    )
  }
  return new TaskWithRetry(taskOrFunc)
}
