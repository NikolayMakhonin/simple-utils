import type { IAbortSignalFast } from '@flemist/abort-controller-fast'
import { type Listener } from 'src/common/rx'
import type { ITimeController } from '@flemist/time-controller'
import { EMPTY_FUNC } from 'src/common/constants'
import { LogLevel } from 'src/common/debug'
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

export type TaskWrapperOptions<
  Result = void,
  Status extends TaskStatusBase<Result> = TaskStatusBase<Result>,
> = {
  statusController: ITaskStatusControllerBase<Result, Status>
  logLevel?: null | LogLevel
}

export class TaskWrapper<
  Args = ArgsDefault,
  Result = void,
  RunOptions extends TaskRunOptionsBase = TaskRunOptionsBase,
  Status extends TaskStatusBase<Result> = TaskStatusBase<Result>,
> implements ITaskWrapper<Args, Result, RunOptions, Status>
{
  protected readonly _task: ITaskWrapperSource<Args, Result, RunOptions, Status>
  readonly #statusController: ITaskStatusControllerBase<Result, Status>
  readonly #logLevel: null | LogLevel
  readonly #supportsArgs: boolean
  readonly #supportsDelay: boolean
  readonly #supportsRepeat: boolean
  readonly #supportsRerun: boolean
  #runOptions: null | RunOptions = null
  #runPromise: Promise<Result> | null = null

  constructor(
    task: ITaskWrapperSource<Args, Result, RunOptions, Status>,
    options: TaskWrapperOptions<Result, Status>,
  ) {
    this._task = task
    this.#statusController = options.statusController
    this.#logLevel = options.logLevel ?? null
    this.#supportsArgs = 'args' in task
    this.#supportsDelay = 'skipDelay' in task
    this.#supportsRepeat = 'skipRepeat' in task
    this.#supportsRerun = 'skipRerun' in task
  }

  get supportsArgs(): boolean {
    return this.#supportsArgs
  }

  get supportsDelay(): boolean {
    return this.#supportsDelay
  }

  get supportsRepeat(): boolean {
    return this.#supportsRepeat
  }

  get supportsRerun(): boolean {
    return this.#supportsRerun
  }

  get args(): Args {
    if (!this.#supportsArgs) {
      throw new Error('[TaskWrapper] Wrapped task does not support args')
    }
    return (this._task as ITaskArgs<Args>).args
  }

  set args(value: Args) {
    if (!this.#supportsArgs) {
      throw new Error('[TaskWrapper] Wrapped task does not support args')
    }
    ;(this._task as ITaskArgs<Args>).args = value
  }

  get status(): Status {
    return this.#statusController.status
  }

  protected get statusInner(): Status {
    return this._task.status
  }

  abort(reason?: any): void {
    this._task.abort(reason)
    this.#statusController.abort(reason)
  }

  get abortSignal(): IAbortSignalFast {
    return this.#statusController.abortSignal
  }

  get timeController(): ITimeController {
    return this.#statusController.timeController
  }

  subscribe(listener: Listener<Status>): Unsubscribe {
    return this.#statusController.subscribe(listener)
  }

  protected runInternal(): Promise<Result> {
    return this._task.run(this.#runOptions)
  }

  run(options?: null | RunOptions): Promise<Result> {
    this.#runOptions = options ?? null
    this.abortSignal.throwIfAborted()
    if (!this.#runPromise) {
      this.#runPromise = this.#statusController
        .run(() => this.runInternal())
        .finally(() => {
          this.#runPromise = null
        })
      // Suppress unhandled rejection when error logging is disabled
      if (this.#logLevel != null && this.#logLevel < LogLevel.error) {
        this.#runPromise.catch(EMPTY_FUNC)
      }
    }
    return this.#runPromise
  }

  wait(): Promise<void> {
    return this._task.wait()
  }

  waitIdle(): Promise<void> {
    return this._task.waitIdle()
  }

  skipDelay(): void {
    if (!this.#supportsDelay) {
      return
    }
    ;(this._task as ITaskDelay).skipDelay()
  }

  skipRepeat(): void {
    if (!this.#supportsRepeat) {
      return
    }
    ;(this._task as ITaskRepeat).skipRepeat()
  }

  skipRerun(): void {
    if (!this.#supportsRerun) {
      return
    }
    ;(this._task as ITaskRerun).skipRerun()
  }
}
