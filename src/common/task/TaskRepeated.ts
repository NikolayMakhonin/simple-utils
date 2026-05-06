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
  type ITaskRerun,
  TASK_STOP,
  type TaskDelayPrepare,
  type TaskFunc,
  type TaskRunOptionsBase,
  type TaskStatusBase,
} from './types'
import { createTaskRerun } from './TaskWithRerun'
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
  private readonly _options: TaskOptionsRepeated<Result, Status>
  private _runPromise: Promise<Result> | null = null
  private _delayAbortController: IAbortControllerFast | null = null

  constructor(
    task: ITaskWrapperSource<Args, Result, RunOptions, Status>,
    options: TaskOptionsRepeated<Result, Status>,
  ) {
    super(task)
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

  private stop(): Result {
    this.abort()
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
      while (!this.abortSignal.aborted) {
        const delayResult = this._options.delay(this.status)

        if (delayResult === TASK_STOP) {
          return this.stop()
        }

        if (!delayResult.skipRun) {
          try {
            await super.run()
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
          this.abortDelay()
        } else if (typeof _delay === 'function') {
          this._delayAbortController = new AbortControllerFast()
          const delayAbortSignal = combineAbortSignals(
            this._delayAbortController.signal,
            this.abortSignal,
          )
          const delayFuncResult = await _delay(this.status, delayAbortSignal)

          this.abortDelay()

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
            return this.stop()
          }
        }
      }
    } finally {
      this._runPromise = null
    }

    this.abortSignal.throwIfAborted()
    return this.status.lastResult!
  }

  run(options?: null | RunOptions): Promise<Result> {
    this.abortSignal.throwIfAborted()
    if (this._runPromise && options?.immediate) {
      super.run(options).catch(EMPTY_FUNC)
    }

    if (!this._runPromise) {
      this._runPromise = this._run()
    }
    return this._runPromise
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
