import {
  AbortControllerFast,
  type IAbortControllerFast,
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
  TASK_STOP,
  type TaskDelayPrepare,
  type TaskFunc,
  type TaskRunOptionsBase,
  type TaskStatusBase,
} from './types'
import { createTaskRerun, type CreateTaskRerunResult } from './TaskWithRerun'
import type { TaskOptionsBase } from './TaskBase'
import { type ITaskWrapperSource, TaskWrapper } from './TaskWrapper'
import { TaskStatusControllerBase } from './TaskStatusControllerBase'

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
  readonly delay: TaskDelayPrepare<Result, Status>
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
  private _runPromise: Promise<Result> | null = null
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

  skipDelay(): void {
    this.abortDelay()
    super.skipDelay()
  }

  skipRepeat(): void {
    this._skipRepeat = true
    this.abortDelay()
  }

  private result(): Result {
    if (this.status.lastEnd == null) {
      throw this.status.abortSignal.reason
    }
    if (this.status.lastHasError) {
      throw this.status.lastError
    }
    return this.status.lastResult!
  }

  private async _run(): Promise<Result> {
    try {
      while (!this.abortSignal.aborted && !this._skipRepeat) {
        const delayResult = this._options.delay(this.status)

        if (delayResult === TASK_STOP) {
          this.abort()
          break
        }

        if (!delayResult.skipRun) {
          try {
            await super.run()
            await this.waitIdle()
          } catch {
            // Ignore errors, because it handles in wrapped task
          }
        }

        if (this._skipRepeat || this.abortSignal.aborted) {
          break
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
          this.abortDelay()
        } else if (typeof _delay === 'function') {
          this._delayAbortController = new AbortControllerFast()
          const delayAbortSignal = combineAbortSignals(
            this._delayAbortController.signal,
            this.abortSignal,
          )
          const delayFuncResult = await _delay(this.status, delayAbortSignal)

          this.abortDelay()

          if (this._skipRepeat || this.abortSignal.aborted) {
            break
          }

          if (typeof delayFuncResult === 'number') {
            this._delayAbortController = new AbortControllerFast()
            const innerDelayAbortSignal = combineAbortSignals(
              this._delayAbortController.signal,
              this.abortSignal,
            )
            await delay(
              delayFuncResult,
              innerDelayAbortSignal,
              this.timeController,
            ).catch(EMPTY_FUNC)
            this.abortDelay()
          } else if (delayFuncResult === TASK_STOP) {
            this.abort()
            break
          }
        }
      }
    } finally {
      this._skipRepeat = false
      this._runPromise = null
    }

    return this.result()
  }

  run(options?: null | RunOptions): Promise<Result> {
    this.abortSignal.throwIfAborted()
    // Calling run() cancels any pending skipRepeat
    this._skipRepeat = false
    if (this._runPromise && options?.immediate) {
      super.run(options).catch(EMPTY_FUNC)
    }

    if (!this._runPromise) {
      this._runPromise = this._run()
    }
    return this._runPromise
  }
}

export type CreateTaskRepeatedResult<Args, Result> = CreateTaskRerunResult<
  Args,
  Result
> & {
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
