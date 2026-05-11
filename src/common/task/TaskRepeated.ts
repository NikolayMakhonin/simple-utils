import {
  AbortControllerFast,
  AbortError,
  type IAbortControllerFast,
  type IAbortSignalFast,
} from '@flemist/abort-controller-fast'
import { combineAbortSignals } from 'src/common/async/abort/combineAbortSignals'
import { delay } from 'src/common/async/wait/delay'
import { EMPTY_FUNC } from 'src/common/constants'
import {
  type ArgsDefault,
  type ITaskBaseWithArgs,
  type ITaskDelay,
  type ITaskRepeat,
  type ITaskRerun,
  type TaskRepeatStrategy,
  type TaskFunc,
  type TaskRunOptionsBase,
  type TaskStatusBase,
} from './types'
import { isPromiseLike } from 'src/common/async'
import { createTaskRerun, type CreateTaskRerunResult } from './TaskWithRerun'
import type { TaskOptionsBase } from './TaskBase'
import { type ITaskWrapperSource, TaskWrapper } from './TaskWrapper'
import { TaskStatusControllerBase } from './TaskStatusControllerBase'
import {
  type ITaskThrottled,
  type TaskOptionsThrottled,
  TaskThrottled,
} from './TaskThrottled'

export type TaskRunOptionsRepeated = TaskRunOptionsBase & {}

export interface ITaskRepeated<
  Args = ArgsDefault,
  Result = void,
  RunOptions extends TaskRunOptionsRepeated = TaskRunOptionsRepeated,
  Status extends TaskStatusBase<Result> = TaskStatusBase<Result>,
> extends ITaskBaseWithArgs<Args, Result, RunOptions, Status>,
    ITaskDelay,
    ITaskRepeat,
    ITaskRerun {}

export type TaskOptionsRepeated<
  Result = void,
  Status extends TaskStatusBase<Result> = TaskStatusBase<Result>,
> = TaskOptionsBase<Result> & {
  readonly repeatStrategy: TaskRepeatStrategy<Result, Status>
}

export class TaskRepeated<
    Args = ArgsDefault,
    Result = void,
    RunOptions extends TaskRunOptionsRepeated = TaskRunOptionsRepeated,
    Status extends TaskStatusBase<Result> = TaskStatusBase<Result>,
  >
  extends TaskWrapper<Args, Result, RunOptions>
  implements ITaskRepeated<Args, Result, RunOptions>
{
  private readonly _options: TaskOptionsRepeated<Result>
  private _delayAbortController: IAbortControllerFast | null = null
  private _skipRepeat: boolean = false

  constructor(
    task: ITaskWrapperSource<Args, Result, RunOptions, Status>,
    options: TaskOptionsRepeated<Result>,
  ) {
    super(task, new TaskStatusControllerBase({}, options))
    this._options = options
  }

  private abortDelay(): void {
    if (this._delayAbortController) {
      this._delayAbortController.abort()
      this._delayAbortController = null
    }
  }

  private createDelayAbortSignal(): IAbortSignalFast {
    this._delayAbortController = new AbortControllerFast()
    return combineAbortSignals(
      this._delayAbortController.signal,
      this.abortSignal,
    )
  }

  skipDelay(): void {
    this.abortDelay()
    super.skipDelay()
  }

  skipRepeat(): void {
    this._skipRepeat = true
    this.abortDelay()
  }

  private result(): Result {
    if (this.statusInner.lastEnd == null) {
      this.abortSignal.throwIfAborted()
      throw new AbortError('Task stopped before first execution')
    }
    if (this.statusInner.lastHasError) {
      throw this.statusInner.lastError
    }
    return this.statusInner.lastResult!
  }

  async runInternal(): Promise<Result> {
    try {
      while (!this.abortSignal.aborted && !this._skipRepeat) {
        const strategyResult = this._options.repeatStrategy(this.statusInner)

        if (strategyResult?.stop) {
          this.abort()
          break
        }

        if (!strategyResult?.skipRun) {
          try {
            await super.runInternal()
            await this.waitIdle()
          } catch {
            // Ignore errors, because it handles in wrapped task
          }
        }

        if (this._skipRepeat || this.abortSignal.aborted) {
          break
        }

        const _delay = strategyResult?.delay

        if (typeof _delay === 'number') {
          if (_delay >= 0) {
            const delayAbortSignal = this.createDelayAbortSignal()
            await delay(_delay, delayAbortSignal, this.timeController).catch(
              EMPTY_FUNC,
            )
            this.abortDelay()
          }
        } else if (typeof _delay === 'function') {
          const delayAbortSignal = this.createDelayAbortSignal()
          const delayResultOrPromise = _delay(
            this.statusInner,
            delayAbortSignal,
          )
          const delayFuncResult = isPromiseLike(delayResultOrPromise)
            ? await delayResultOrPromise
            : delayResultOrPromise

          if (this._skipRepeat || this.abortSignal.aborted) {
            break
          }

          let afterDelay: number | null | undefined

          if (typeof delayFuncResult === 'number') {
            afterDelay = delayFuncResult
          } else if (delayFuncResult != null) {
            if (delayFuncResult.stop) {
              this.abort()
              break
            }
            afterDelay = delayFuncResult.delay
          }

          if (afterDelay != null && afterDelay >= 0) {
            await delay(
              afterDelay,
              delayAbortSignal,
              this.timeController,
            ).catch(EMPTY_FUNC)
          }

          this.abortDelay()
        }
      }
    } finally {
      this.abortDelay()
      this._skipRepeat = false
    }

    return this.result()
  }

  run(options?: null | RunOptions): Promise<Result> {
    // Calling run() cancels any pending skipRepeat
    this._skipRepeat = false
    if (this.status.isRunning && options?.immediate) {
      super.runInternal(options).catch(EMPTY_FUNC)
    }
    return super.run()
  }
}

export type CreateTaskRepeatedResult<
  Args = ArgsDefault,
  Result = void,
> = CreateTaskRerunResult<Args, Result> & {
  repeated: ITaskRepeated<Args, Result>
}

export function createTaskRepeated<Args = ArgsDefault, Result = void>(
  func: TaskFunc<Args, Result>,
  args: Args,
  options: TaskOptionsRepeated<Result>,
): CreateTaskRepeatedResult<Args, Result> {
  const base = createTaskRerun(func, args, options)
  const repeated = new TaskRepeated(base.rerun, options)
  return {
    ...base,
    repeated,
  }
}

export type CreateTaskRepeatedThrottledResult<
  Args = ArgsDefault,
  Result = void,
> = CreateTaskRepeatedResult<Args, Result> & {
  throttled: ITaskThrottled<Args, Result>
}

export function createTaskRepeatedThrottled<Args = ArgsDefault, Result = void>(
  func: TaskFunc<Args, Result>,
  args: Args,
  options: TaskOptionsRepeated<Result> & TaskOptionsThrottled<Result>,
): CreateTaskRepeatedThrottledResult<Args, Result> {
  const base = createTaskRepeated(func, args, options)
  const throttled = new TaskThrottled(base.repeated, options)
  return {
    ...base,
    throttled,
  }
}
