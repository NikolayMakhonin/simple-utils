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
  type TaskRepeatStrategyBefore,
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
  readonly #options: TaskOptionsRepeated<Result>
  #delayAbortController: IAbortControllerFast | null = null
  #skipRepeat: boolean = false

  constructor(
    task: ITaskWrapperSource<Args, Result, RunOptions, Status>,
    options: TaskOptionsRepeated<Result>,
  ) {
    super(task, {
      statusController: new TaskStatusControllerBase({}, options),
      logLevel: options.logLevel,
    })
    this.#options = options
  }

  private abortDelay(): void {
    if (this.#delayAbortController) {
      this.#delayAbortController.abort()
      this.#delayAbortController = null
    }
  }

  private createDelayAbortSignal(): IAbortSignalFast {
    this.#delayAbortController = new AbortControllerFast()
    return combineAbortSignals(
      this.#delayAbortController.signal,
      this.abortSignal,
    )
  }

  skipDelay(): void {
    this.abortDelay()
    super.skipDelay()
  }

  skipRepeat(): void {
    this.#skipRepeat = true
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

  protected async runInternal(): Promise<Result> {
    try {
      let prevTotalStarts = this.statusInner.totalStarts
      let strategyResult:
        | void
        | undefined
        | null
        | TaskRepeatStrategyBefore<Result>
      while (!this.abortSignal.aborted && !this.#skipRepeat) {
        // If task was started during delay stage, then we should wait idle and run delay with previous strategyResult
        if (prevTotalStarts === this.statusInner.totalStarts) {
          strategyResult = this.#options.repeatStrategy(this.statusInner)

          if (strategyResult?.stop) {
            this.abort(strategyResult.stopReason)
            break
          }
        }

        if (
          prevTotalStarts !== this.statusInner.totalStarts ||
          !strategyResult?.skipRun
        ) {
          try {
            if (prevTotalStarts === this.statusInner.totalStarts) {
              await super.runInternal()
            }
            await this.waitIdle()
          } catch {
            // Ignore errors, because it handles in wrapped task
          }
          prevTotalStarts = this.statusInner.totalStarts
        }

        if (this.#skipRepeat || this.abortSignal.aborted) {
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

          if (this.#skipRepeat || this.abortSignal.aborted) {
            this.abortDelay()
            break
          }

          if (prevTotalStarts !== this.statusInner.totalStarts) {
            this.abortDelay()
            continue
          }

          let afterDelay: number | null | undefined

          if (typeof delayFuncResult === 'number') {
            afterDelay = delayFuncResult
          } else if (delayFuncResult != null) {
            if (delayFuncResult.stop) {
              this.abort(delayFuncResult.stopReason)
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
      this.#skipRepeat = false
    }

    return this.result()
  }

  run(options?: null | RunOptions): Promise<Result> {
    if (options?.immediate) {
      // Abort pending delay to prevent a second execution after it completes
      this.skipDelay()
      // Execute immediately, bypassing repeatStrategy that may skip or stop
      super.runInternal().catch(EMPTY_FUNC)
    }
    // Calling run() cancels any pending skipRepeat
    this.#skipRepeat = false
    return super.run(options)
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
