// TODO: Result = void, Status = TaskStatusBase<Result>
import {
  AbortControllerFast,
  type IAbortControllerFast,
} from '@flemist/abort-controller-fast'
import {
  combineAbortSignals,
  delay,
  EMPTY_FUNC,
  type PromiseOrValue,
} from '@flemist/async-utils'
import { waitObservable } from 'src/common/rx'
import {
  type ITaskBaseWithArgs,
  type ITaskDelay,
  type ITaskRerun,
  type TaskDelay,
  type TaskFunc,
  type TaskRunOptionsBase,
  type TaskStatusBase,
} from './types'
import { createTaskRerun } from './TaskRerun'
import type { TaskOptionsBase } from './TaskBase'
import { type ITaskWrapperSource, TaskWrapper } from './TaskWrapper'

export type TaskRunOptionsRepeated = TaskRunOptionsBase & {}

// TODO: Result = void, Status = TaskStatusBase<Result>, RunOptions = TaskRunOptionsRepeated, Args = never
export interface ITaskRepeated<
  Result,
  Status extends TaskStatusBase<Result>,
  RunOptions extends TaskRunOptionsRepeated,
  Args,
> extends ITaskBaseWithArgs<Result, Status, RunOptions, Args>,
    ITaskDelay,
    ITaskRerun {}

export type TaskOptionsRepeated<
  Result,
  Status extends TaskStatusBase<Result>,
> = TaskOptionsBase & {
  readonly delay: TaskDelay<Result, Status>
}

export class TaskRepeated<
    Result,
    Status extends TaskStatusBase<Result>,
    RunOptions extends TaskRunOptionsRepeated,
    Args,
  >
  extends TaskWrapper<Result, Status, TaskRunOptionsBase, Args>
  implements ITaskRepeated<Result, Status, RunOptions, Args>
{
  private readonly _options: null | TaskOptionsRepeated<Result, Status>
  private _inProcess: boolean = false
  private _delayAbortController: IAbortControllerFast | null = null

  constructor(
    task: ITaskWrapperSource<Result, Status, RunOptions, Args>,
    options: TaskOptionsRepeated<Result, Status>,
  ) {
    super(task)
    this._options = options ?? null
  }

  skipDelay(): void {
    if (this._delayAbortController) {
      this._delayAbortController.abort()
      this._delayAbortController = null
    }
    super.skipDelay()
  }

  private async process(): Promise<void> {
    if (this._inProcess) {
      return
    }
    this._inProcess = true

    try {
      while (!this.abortSignal.aborted) {
        const delayResult = this._options!.delay(this.status)

        if (delayResult.stop) {
          this.abort()
          return
        }

        if (!delayResult.skipRun) {
          try {
            await super.run(delayResult.isRetry ? { isRetry: true } : undefined)
            await this.waitIdle()
          } catch {
            // Ignore errors, because it handles in wrapped task
          }
        }

        const _delay = delayResult.delay

        if (typeof _delay === 'number') {
          this._delayAbortController = new AbortControllerFast()
          const delayAbortSignal = combineAbortSignals(
            this._delayAbortController.signal,
            this.abortSignal,
          )
          await delay(_delay, delayAbortSignal, this.timeController).catch(
            EMPTY_FUNC,
          )
          this._delayAbortController = null
        } else if (typeof _delay === 'function') {
          this._delayAbortController = new AbortControllerFast()
          const delayAbortSignal = combineAbortSignals(
            this._delayAbortController.signal,
            this.abortSignal,
          )
          await _delay(delayAbortSignal).catch(EMPTY_FUNC)
          this._delayAbortController = null
        }
      }
    } finally {
      this._inProcess = false
    }
  }

  run(options?: null | RunOptions): PromiseOrValue<Result> {
    this.abortSignal.throwIfAborted()
    if (options?.immediate) {
      return super.run(options)
    }

    const abortSignal = this.abortSignal
    void this.process()

    const waitRerun = this.supportsRerun && this.status.isRunning
    return waitObservable(this, status => !status.isRunning, abortSignal).then(
      status => {
        if (!waitRerun) {
          return status.lastResult!
        }
        return waitObservable(
          this,
          status => !status.isRunning,
          abortSignal,
        ).then(status => {
          return status.lastResult!
        })
      },
    )
  }
}

export function createTaskRepeated<
  Result,
  Status extends TaskStatusBase<Result>,
  RunOptions extends TaskRunOptionsRepeated,
  Args,
>(
  task: ITaskWrapperSource<Result, Status, RunOptions, Args>,
  options: TaskOptionsRepeated<Result, Status>,
): ITaskRepeated<Result, Status, RunOptions, Args>
export function createTaskRepeated<
  Result,
  Status extends TaskStatusBase<Result>,
  RunOptions extends TaskRunOptionsRepeated,
  Args,
>(
  func: TaskFunc<Args, Result>,
  args: Args,
  options: TaskOptionsRepeated<Result, Status>,
): ITaskRepeated<Result, Status, RunOptions, Args>
export function createTaskRepeated<
  Result,
  Status extends TaskStatusBase<Result>,
  RunOptions extends TaskRunOptionsRepeated,
  Args,
>(
  taskOrFunc:
    | ITaskWrapperSource<Result, Status, RunOptions, Args>
    | TaskFunc<Args, Result>,
  argsOrOptions: Args | TaskOptionsRepeated<Result, Status>,
  optionsArg?: null | TaskOptionsRepeated<Result, Status>,
): ITaskRepeated<Result, Status, RunOptions, Args> {
  if (typeof taskOrFunc === 'function') {
    return new TaskRepeated(
      createTaskRerun(taskOrFunc, argsOrOptions as Args, optionsArg),
      optionsArg!,
    )
  }
  return new TaskRepeated(
    taskOrFunc,
    argsOrOptions as TaskOptionsRepeated<Result, Status>,
  )
}
