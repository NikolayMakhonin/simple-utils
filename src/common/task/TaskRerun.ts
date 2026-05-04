import {
  EMPTY_FUNC,
  isPromiseLike,
  promiseLikeToPromise,
  type PromiseOrValue,
} from '@flemist/async-utils'
import {
  type ITaskBaseWithArgs,
  type ITaskRerun,
  type TaskFunc,
  type TaskRunOptionsBase,
  type TaskStatusBase,
} from './types'
import { TaskBase, type TaskOptionsBase } from './TaskBase'
import { type ITaskWrapperSource, TaskWrapper } from './TaskWrapper'

export type ITaskWithRerun<
  Result = void,
  Status extends TaskStatusBase<Result> = TaskStatusBase<Result>,
  RunOptions extends TaskRunOptionsBase = TaskRunOptionsBase,
  Args = never,
> = ITaskBaseWithArgs<Result, Status, RunOptions, Args> & ITaskRerun

export class TaskWithRerun<
    Result,
    Status extends TaskStatusBase<Result>,
    RunOptions extends TaskRunOptionsBase,
    Args,
  >
  extends TaskWrapper<Result, Status, RunOptions, Args>
  implements ITaskWithRerun<Result, Status, RunOptions, Args>
{
  private readonly _wait: () => PromiseOrValue<void>
  private _runPromise: Promise<Result> | null = null

  constructor(task: ITaskWrapperSource<Result, Status, RunOptions, Args>) {
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
  Result,
  Status extends TaskStatusBase<Result>,
  RunOptions extends TaskRunOptionsBase,
  Args,
>(
  task: ITaskWrapperSource<Result, Status, RunOptions, Args>,
): ITaskWithRerun<Result, Status, RunOptions, Args>
export function createTaskRerun<
  Result,
  Status extends TaskStatusBase<Result>,
  RunOptions extends TaskRunOptionsBase,
  Args,
>(
  func: TaskFunc<Args, Result>,
  args: Args,
  options?: null | TaskOptionsBase,
): ITaskWithRerun<Result, Status, RunOptions, Args>
export function createTaskRerun<
  Result,
  Status extends TaskStatusBase<Result>,
  RunOptions extends TaskRunOptionsBase,
  Args,
>(
  taskOrFunc:
    | ITaskWrapperSource<Result, Status, RunOptions, Args>
    | TaskFunc<Args, Result>,
  argsOrOptions?: Args | (null | TaskOptionsBase),
  optionsArg?: null | TaskOptionsBase,
): ITaskWithRerun<Result, Status, RunOptions, Args> {
  if (typeof taskOrFunc === 'function') {
    return new TaskWithRerun(
      new TaskBase(taskOrFunc, argsOrOptions as Args, optionsArg),
    )
  }
  return new TaskWithRerun(taskOrFunc)
}
