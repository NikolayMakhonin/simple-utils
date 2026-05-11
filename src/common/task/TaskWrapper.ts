import type { IAbortSignalFast } from '@flemist/abort-controller-fast'
import { type Listener } from 'src/common/rx'
import type { ITimeController } from '@flemist/time-controller'
import type { Unsubscribe } from 'src/common/types'
import type {
  ArgsDefault,
  ITaskArgs,
  ITaskBase,
  ITaskDelay,
  ITaskRepeat,
  ITaskRerun,
  TaskRunOptionsBase,
  TaskStatusBase,
} from './types'
import { type ITaskStatusControllerBase } from './TaskStatusControllerBase'

export type ITaskWrapperSource<
  Args = ArgsDefault,
  Result = void,
  RunOptions extends TaskRunOptionsBase = TaskRunOptionsBase,
  Status extends TaskStatusBase<Result> = TaskStatusBase<Result>,
> = ITaskBase<Result, RunOptions, Status> &
  (ITaskArgs<Args> | ITaskDelay | ITaskRepeat | ITaskRerun | {})

export interface ITaskWrapper<
  Args = ArgsDefault,
  Result = void,
  RunOptions extends TaskRunOptionsBase = TaskRunOptionsBase,
  Status extends TaskStatusBase<Result> = TaskStatusBase<Result>,
> extends ITaskBase<Result, RunOptions, Status>,
    ITaskArgs<Args>,
    ITaskDelay,
    ITaskRepeat,
    ITaskRerun {
  readonly supportsArgs: boolean
  readonly supportsDelay: boolean
  readonly supportsRepeat: boolean
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
  private readonly _statusController: ITaskStatusControllerBase<Result, Status>
  private readonly _supportsArgs: boolean
  private readonly _supportsDelay: boolean
  private readonly _supportsRepeat: boolean
  private readonly _supportsRerun: boolean
  private _runPromise: Promise<Result> | null = null

  constructor(
    task: ITaskWrapperSource<Args, Result, RunOptions, Status>,
    statusController: ITaskStatusControllerBase<Result, Status>,
  ) {
    this._task = task
    this._statusController = statusController
    this._supportsArgs = 'args' in task
    this._supportsDelay = 'skipDelay' in task
    this._supportsRepeat = 'skipRepeat' in task
    this._supportsRerun = 'skipRerun' in task
  }

  get supportsArgs(): boolean {
    return this._supportsArgs
  }

  get supportsDelay(): boolean {
    return this._supportsDelay
  }

  get supportsRepeat(): boolean {
    return this._supportsRepeat
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
    return this._statusController.status
  }

  protected get statusInner(): Status {
    return this._task.status
  }

  abort(): void {
    this._task.abort()
    this._statusController.abort()
  }

  get abortSignal(): IAbortSignalFast {
    return this._statusController.abortSignal
  }

  get timeController(): ITimeController {
    return this._statusController.timeController
  }

  subscribe(listener: Listener<Status>): Unsubscribe {
    return this._statusController.subscribe(listener)
  }

  protected runInternal(options?: null | RunOptions): Promise<Result> {
    return this._task.run(options)
  }

  run(options?: null | RunOptions): Promise<Result> {
    this.abortSignal.throwIfAborted()
    if (!this._runPromise) {
      this._runPromise = this._statusController
        .run(() => this.runInternal(options))
        .finally(() => {
          this._runPromise = null
        })
    }
    return this._runPromise
  }

  wait(): Promise<void> {
    return this._task.wait()
  }

  waitIdle(): Promise<void> {
    return this._task.waitIdle()
  }

  skipDelay(): void {
    if (!this._supportsDelay) {
      return
    }
    ;(this._task as ITaskDelay).skipDelay()
  }

  skipRepeat(): void {
    if (!this._supportsRepeat) {
      return
    }
    ;(this._task as ITaskRepeat).skipRepeat()
  }

  skipRerun(): void {
    if (!this._supportsRerun) {
      return
    }
    ;(this._task as ITaskRerun).skipRerun()
  }
}
