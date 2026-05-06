import type { IAbortSignalFast } from '@flemist/abort-controller-fast'
import type { ITimeController } from '@flemist/time-controller'
import type { Listener } from 'src/common/rx'
import type { Unsubscribe } from 'src/common/types'
import type { PromiseOrValue } from 'src/common/types/common'
import type {
  ArgsDefault,
  ITaskArgs,
  ITaskBase,
  ITaskDelay,
  ITaskRerun,
  TaskRunOptionsBase,
  TaskStatusBase,
} from './types'

export type ITaskWrapperSource<
  Args = ArgsDefault,
  Result = void,
  RunOptions extends TaskRunOptionsBase = TaskRunOptionsBase,
  Status extends TaskStatusBase<Result> = TaskStatusBase<Result>,
> = ITaskBase<Result, RunOptions, Status> &
  (ITaskArgs<Args> | ITaskDelay | ITaskRerun | {})

export interface ITaskWrapper<
  Args = ArgsDefault,
  Result = void,
  RunOptions extends TaskRunOptionsBase = TaskRunOptionsBase,
  Status extends TaskStatusBase<Result> = TaskStatusBase<Result>,
> extends ITaskBase<Result, RunOptions, Status>,
    ITaskArgs<Args>,
    ITaskDelay,
    ITaskRerun {
  readonly supportsArgs: boolean
  readonly supportsDelay: boolean
  readonly supportsRerun: boolean
}

export class TaskWrapper<
  Args = ArgsDefault,
  Result = void,
  RunOptions extends TaskRunOptionsBase = TaskRunOptionsBase,
  Status extends TaskStatusBase<Result> = TaskStatusBase<Result>,
> implements ITaskWrapper<Args, Result, RunOptions, Status>
{
  protected readonly _task: ITaskWrapperSource<Args, Result, RunOptions, Status>
  private readonly _supportsArgs: boolean
  private readonly _supportsDelay: boolean
  private readonly _supportsRerun: boolean

  constructor(task: ITaskWrapperSource<Args, Result, RunOptions, Status>) {
    this._task = task
    this._supportsArgs = 'args' in task
    this._supportsDelay = 'skipDelay' in task
    this._supportsRerun = 'skipRerun' in task
  }

  get supportsArgs(): boolean {
    return this._supportsArgs
  }

  get supportsDelay(): boolean {
    return this._supportsDelay
  }

  get supportsRerun(): boolean {
    return this._supportsRerun
  }

  get args(): Args {
    if (!this._supportsArgs) {
      throw new Error('[TaskWrapper] Wrapped task does not support args')
    }
    return (this._task as ITaskArgs<Args>).args
  }

  set args(value: Args) {
    if (!this._supportsArgs) {
      throw new Error('[TaskWrapper] Wrapped task does not support args')
    }
    ;(this._task as ITaskArgs<Args>).args = value
  }

  get status(): Status {
    return this._task.status
  }

  abort(): void {
    this._task.abort()
  }

  get abortSignal(): IAbortSignalFast {
    return this._task.abortSignal
  }

  get timeController(): ITimeController {
    return this._task.timeController
  }

  subscribe(listener: Listener<Status>): Unsubscribe {
    return this._task.subscribe(listener)
  }

  run(options?: null | RunOptions): PromiseOrValue<Result> {
    return this._task.run(options)
  }

  wait(): PromiseOrValue<void> {
    return this._task.wait()
  }

  waitIdle(): PromiseOrValue<void> {
    return this._task.waitIdle()
  }

  skipDelay(): void {
    if (!this._supportsDelay) {
      return
    }
    ;(this._task as ITaskDelay).skipDelay()
  }

  skipRerun(): void {
    if (!this._supportsRerun) {
      return
    }
    ;(this._task as ITaskRerun).skipRerun()
  }
}
