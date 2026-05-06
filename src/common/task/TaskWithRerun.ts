import { EMPTY_FUNC } from 'src/common/constants'
import { isPromiseLike, promiseLikeToPromise } from 'src/common/async/promise'
import type { PromiseOrValue } from 'src/common/types/common'
import {
  type ArgsDefault,
  type ITaskBaseWithArgs,
  type ITaskRerun,
  type TaskFunc,
  type TaskRunOptionsBase,
  type TaskStatusBase,
} from './types'
import { TaskBase, type TaskOptionsBase } from './TaskBase'
import { type ITaskWrapperSource, TaskWrapper } from './TaskWrapper'

export type ITaskWithRerun<
  Args = ArgsDefault,
  Result = void,
  RunOptions extends TaskRunOptionsBase = TaskRunOptionsBase,
  Status extends TaskStatusBase<Result> = TaskStatusBase<Result>,
> = ITaskBaseWithArgs<Args, Result, RunOptions, Status> & ITaskRerun

export class TaskWithRerun<
    Args = ArgsDefault,
    Result = void,
    RunOptions extends TaskRunOptionsBase = TaskRunOptionsBase,
    Status extends TaskStatusBase<Result> = TaskStatusBase<Result>,
  >
  extends TaskWrapper<Args, Result, RunOptions, Status>
  implements ITaskWithRerun<Args, Result, RunOptions, Status>
{
  private readonly _wait: () => PromiseOrValue<void>
  private _runPromise: Promise<Result> | null = null

  constructor(task: ITaskWrapperSource<Args, Result, RunOptions, Status>) {
    super(task)
    this._wait = () => this.wait()
  }

  run(options?: null | RunOptions): PromiseOrValue<Result> {
    this.abortSignal.throwIfAborted()
    if (this._runPromise) {
      return this._runPromise
    }

    const isRunning = this.status.isRunning
    const promiseOrResult = super.run(options)

    if (!isRunning || !isPromiseLike(promiseOrResult)) {
      return promiseOrResult
    }

    const runPromise = promiseOrResult
      .then(result => {
        // If rerun was skipped
        // return the result of the first run
        if (runPromise !== this._runPromise) {
          return result
        }
        return super.run(options)
      })
      .finally(() => {
        if (runPromise === this._runPromise) {
          this._runPromise = null
        }
      })
    this._runPromise = runPromise

    return this._runPromise
  }

  skipRerun(): void {
    this._runPromise = null
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

export function createTaskRerun<
  Args = ArgsDefault,
  Result = void,
  RunOptions extends TaskRunOptionsBase = TaskRunOptionsBase,
  Status extends TaskStatusBase<Result> = TaskStatusBase<Result>,
>(
  task: ITaskWrapperSource<Args, Result, RunOptions, Status>,
): ITaskWithRerun<Args, Result, RunOptions, Status>
export function createTaskRerun<Args = ArgsDefault, Result = void>(
  func: TaskFunc<Args, Result>,
  args: Args,
  options?: null | TaskOptionsBase,
): ITaskWithRerun<Args, Result>
export function createTaskRerun<
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
): ITaskWithRerun<Args, Result, RunOptions, Status> {
  if (typeof taskOrFunc === 'function') {
    return new TaskWithRerun(
      new TaskBase(taskOrFunc, argsOrOptions as Args, optionsArg),
    )
  }
  return new TaskWithRerun(taskOrFunc)
}
