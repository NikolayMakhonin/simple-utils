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
  type ArgsDefault,
  type ITaskBaseWithArgs,
  type ITaskDelay,
  type ITaskRerun,
  type TaskDelayPrepare,
  type TaskFunc,
  type TaskRunOptionsBase,
  type TaskStatusBase,
} from './types'
import { createTaskRerun } from './TaskRerun'
import type { TaskOptionsBase } from './TaskBase'
import { type ITaskWrapperSource, TaskWrapper } from './TaskWrapper'

export type TaskRunOptionsRepeated = TaskRunOptionsBase & {}

export interface ITaskRepeated<
  Args = ArgsDefault,
  Result = void,
  RunOptions extends TaskRunOptionsRepeated = TaskRunOptionsRepeated,
  Status extends TaskStatusBase<Result> = TaskStatusBase<Result>,
> extends ITaskBaseWithArgs<Args, Result, RunOptions, Status>,
    ITaskDelay,
    ITaskRerun {}

export type TaskOptionsRepeated<
  Result = void,
  Status extends TaskStatusBase<Result> = TaskStatusBase<Result>,
> = TaskOptionsBase & {
  readonly delay: TaskDelayPrepare<Result, Status>
}

export class TaskRepeated<
    Args = ArgsDefault,
    Result = void,
    RunOptions extends TaskRunOptionsRepeated = TaskRunOptionsRepeated,
    Status extends TaskStatusBase<Result> = TaskStatusBase<Result>,
  >
  extends TaskWrapper<Args, Result, TaskRunOptionsBase, Status>
  implements ITaskRepeated<Args, Result, RunOptions, Status>
{
  private readonly _options: null | TaskOptionsRepeated<Result, Status>
  private _inProcess: boolean = false
  private _delayAbortController: IAbortControllerFast | null = null

  constructor(
    task: ITaskWrapperSource<Args, Result, RunOptions, Status>,
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
      let nextIsRetry = false

      while (!this.abortSignal.aborted) {
        const delayResult = this._options!.delay(this.status)

        if (delayResult.stop) {
          this.abort()
          return
        }

        if (!delayResult.skipRun) {
          try {
            await super.run(nextIsRetry ? { isRetry: true } : undefined)
            await this.waitIdle()
          } catch {
            // Ignore errors, because it handles in wrapped task
          }
        }

        nextIsRetry = false

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
          const delayFuncResult = await _delay(this.status, delayAbortSignal)

          this._delayAbortController = null

          if (delayFuncResult.stop) {
            this.abort()
            return
          }

          if (delayFuncResult.retry) {
            nextIsRetry = true
          }

          if (delayFuncResult.delay != null) {
            this._delayAbortController = new AbortControllerFast()
            const innerDelayAbortSignal = combineAbortSignals(
              this._delayAbortController.signal,
              this.abortSignal,
            )
            await delay(
              delayFuncResult.delay,
              innerDelayAbortSignal,
              this.timeController,
            ).catch(EMPTY_FUNC)
            this._delayAbortController = null
          }
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
  Args = ArgsDefault,
  Result = void,
  RunOptions extends TaskRunOptionsRepeated = TaskRunOptionsRepeated,
  Status extends TaskStatusBase<Result> = TaskStatusBase<Result>,
>(
  task: ITaskWrapperSource<Args, Result, RunOptions, Status>,
  options: TaskOptionsRepeated<Result, Status>,
): ITaskRepeated<Args, Result, RunOptions, Status>
export function createTaskRepeated<Args = ArgsDefault, Result = void>(
  func: TaskFunc<Args, Result>,
  args: Args,
  options: TaskOptionsRepeated<Result>,
): ITaskRepeated<Args, Result>
export function createTaskRepeated<
  Args = ArgsDefault,
  Result = void,
  RunOptions extends TaskRunOptionsRepeated = TaskRunOptionsRepeated,
  Status extends TaskStatusBase<Result> = TaskStatusBase<Result>,
>(
  taskOrFunc:
    | ITaskWrapperSource<Args, Result, RunOptions, Status>
    | TaskFunc<Args, Result>,
  argsOrOptions: Args | TaskOptionsRepeated<Result, Status>,
  optionsArg?: null | TaskOptionsRepeated<Result, Status>,
): ITaskRepeated<Args, Result, RunOptions, Status> {
  if (typeof taskOrFunc === 'function') {
    return new TaskRepeated(
      createTaskRerun(taskOrFunc, argsOrOptions as Args, optionsArg) as any,
      optionsArg!,
    )
  }
  return new TaskRepeated(
    taskOrFunc,
    argsOrOptions as TaskOptionsRepeated<Result, Status>,
  )
}
