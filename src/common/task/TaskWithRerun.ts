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
  readonly #wait: () => Promise<void>
  #rerunPromise: Promise<Result> | null = null

  constructor(
    task: ITaskWrapperSource<Args, Result, RunOptions, Status>,
    options?: null | TaskOptionsBase<Result>,
  ) {
    super(task, {
      statusController: new TaskStatusControllerBase({}, options),
      logLevel: options?.logLevel,
    })
    this.#wait = () => this.wait()
  }

  protected runInternal(): Promise<Result> {
    if (this.#rerunPromise) {
      return this.#rerunPromise
    }

    const isRunning = this.statusInner.isRunning
    const firstRunPromise = super.runInternal()

    if (!isRunning) {
      return firstRunPromise
    }

    const runPromise = firstRunPromise
      .then(result => {
        // If rerun was skipped
        // return the result of the first run
        if (runPromise !== this.#rerunPromise) {
          return result
        }
        return super.runInternal()
      })
      .finally(() => {
        if (runPromise === this.#rerunPromise) {
          this.#rerunPromise = null
        }
      })
    this.#rerunPromise = runPromise

    return this.#rerunPromise
  }

  skipRerun(): void {
    this.#rerunPromise = null
  }

  wait(): Promise<void> {
    return this.#rerunPromise?.then(EMPTY_FUNC, EMPTY_FUNC) ?? super.wait()
  }

  waitIdle(): Promise<void> {
    if (this.#rerunPromise) {
      return this.#rerunPromise.then(this.#wait, this.#wait)
    }
    return super.wait().then(this.#wait)
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
