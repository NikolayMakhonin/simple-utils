import { EMPTY_FUNC } from 'src/common/constants'
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
import { TaskStatusControllerBase } from './TaskStatusControllerBase'

export interface ITaskWithRerun<
  Args = ArgsDefault,
  Result = void,
  RunOptions extends TaskRunOptionsBase = TaskRunOptionsBase,
  Status extends TaskStatusBase<Result> = TaskStatusBase<Result>,
> extends ITaskBaseWithArgs<Args, Result, RunOptions, Status>,
    ITaskRerun {}

export class TaskWithRerun<
    Args = ArgsDefault,
    Result = void,
    RunOptions extends TaskRunOptionsBase = TaskRunOptionsBase,
    Status extends TaskStatusBase<Result> = TaskStatusBase<Result>,
  >
  extends TaskWrapper<Args, Result, RunOptions>
  implements ITaskWithRerun<Args, Result, RunOptions>
{
  private readonly _wait: () => Promise<void>
  private _rerunPromise: Promise<Result> | null = null

  constructor(
    task: ITaskWrapperSource<Args, Result, RunOptions, Status>,
    options?: null | TaskOptionsBase<Result>,
  ) {
    super(task, new TaskStatusControllerBase({}, options))
    this._wait = () => this.wait()
  }

  protected runInternal(options?: null | RunOptions): Promise<Result> {
    if (this._rerunPromise) {
      return this._rerunPromise
    }

    const isRunning = this.statusInner.isRunning
    const firstRunPromise = super.runInternal(options)

    if (!isRunning) {
      return firstRunPromise
    }

    const runPromise = firstRunPromise
      .then(result => {
        // If rerun was skipped
        // return the result of the first run
        if (runPromise !== this._rerunPromise) {
          return result
        }
        return super.runInternal(options)
      })
      .finally(() => {
        if (runPromise === this._rerunPromise) {
          this._rerunPromise = null
        }
      })
    this._rerunPromise = runPromise

    return this._rerunPromise
  }

  skipRerun(): void {
    this._rerunPromise = null
  }

  wait(): Promise<void> {
    return this._rerunPromise?.then(EMPTY_FUNC, EMPTY_FUNC) ?? super.wait()
  }

  waitIdle(): Promise<void> {
    if (this._rerunPromise) {
      return this._rerunPromise.then(this._wait, this._wait)
    }
    return super.wait().then(this._wait)
  }
}

export type CreateTaskRerunResult<Args = ArgsDefault, Result = void> = {
  base: ITaskBaseWithArgs<Args, Result>
  rerun: ITaskWithRerun<Args, Result>
}

export function createTaskRerun<Args = ArgsDefault, Result = void>(
  func: TaskFunc<Args, Result>,
  args: Args,
  options?: null | TaskOptionsBase<Result>,
): CreateTaskRerunResult<Args, Result> {
  const base = new TaskBase(func, args, options)
  const rerun = new TaskWithRerun(base, options)
  return {
    base,
    rerun,
  }
}
