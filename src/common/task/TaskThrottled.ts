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
  type TaskFunc,
  type TaskRunOptionsBase,
  type TaskStatusBase,
} from './types'
import { createTaskRerun, type CreateTaskRerunResult } from './TaskWithRerun'
import type { TaskOptionsBase } from './TaskBase'
import { type ITaskWrapperSource, TaskWrapper } from './TaskWrapper'
import { TaskStatusControllerBase } from './TaskStatusControllerBase'

export type TaskRunOptionsThrottled = TaskRunOptionsBase & {
  readonly throttleTime?: null | number
  readonly throttleTimeMax?: null | number
  /**
   * false/undefined - throttle time counts from the last execution start
   * true - throttle time counts from the last execution end;
   *   executes immediately when never executed or enough time passed
   */
  readonly throttleFromEnd?: null | boolean
}

export interface ITaskThrottled<
  Args = ArgsDefault,
  Result = void,
  RunOptions extends TaskRunOptionsThrottled = TaskRunOptionsThrottled,
  Status extends TaskStatusBase<Result> = TaskStatusBase<Result>,
> extends ITaskBaseWithArgs<Args, Result, RunOptions, Status>,
    ITaskDelay,
    ITaskRerun {}

export type TaskOptionsThrottled<Result> = TaskOptionsBase<Result> & {
  readonly throttleTime?: null | number
  readonly throttleTimeMax?: null | number
  /**
   * false/undefined - throttle time counts from the last execution start
   * true - throttle time counts from the last execution end;
   *   executes immediately when never executed or enough time passed
   */
  readonly throttleFromEnd?: null | boolean
}

export class TaskThrottled<
    Args = ArgsDefault,
    Result = void,
    RunOptions extends TaskRunOptionsThrottled = TaskRunOptionsThrottled,
    Status extends TaskStatusBase<Result> = TaskStatusBase<Result>,
  >
  extends TaskWrapper<Args, Result, RunOptions>
  implements ITaskThrottled<Args, Result, RunOptions>
{
  private readonly _options: null | TaskOptionsThrottled<Result>
  private _timerAbortController: IAbortControllerFast | null = null
  private _timerTargetTime: number | null = null
  private _nextCallTime: number | null = null
  private _lastCallTime: number | null = null
  private _throttleTimeCurrent: number | null = null
  private _throttleTimeMaxCurrent: number | null = null
  private _throttleFromEnd: boolean = false

  constructor(
    task: ITaskWrapperSource<Args, Result, RunOptions, Status>,
    options?: null | TaskOptionsThrottled<Result>,
  ) {
    super(task, new TaskStatusControllerBase({}, options))
    this._options = options ?? null
    this._throttleFromEnd = !!this._options?.throttleFromEnd
  }

  private updateThrottleTime(
    throttleTime?: null | number,
    _throttleTimeMax?: null | number | false,
  ): void {
    const throttleTimeNew = throttleTime ?? this._options?.throttleTime ?? 0
    this._throttleTimeCurrent =
      this._throttleTimeCurrent == null
        ? throttleTimeNew
        : Math.min(this._throttleTimeCurrent, throttleTimeNew)
    this._throttleTimeMaxCurrent =
      _throttleTimeMax == null
        ? (this._options?.throttleTimeMax ?? null)
        : _throttleTimeMax === false
          ? null
          : _throttleTimeMax
  }

  private updateNextCallTime(): void {
    if (this._throttleTimeCurrent == null) {
      return
    }
    const now = this.timeController.now()
    let newNextCallTime =
      this._lastCallTime == null
        ? now
        : this._lastCallTime + this._throttleTimeCurrent
    if (this._throttleTimeMaxCurrent != null) {
      const lastCallTime = this._lastCallTime ?? now
      newNextCallTime = Math.min(
        newNextCallTime,
        lastCallTime + this._throttleTimeMaxCurrent,
      )
    }
    this._nextCallTime = newNextCallTime
    if (
      this._timerTargetTime != null &&
      this._timerAbortController != null &&
      this._nextCallTime <= this._timerTargetTime
    ) {
      this._timerAbortController.abort()
      this._timerAbortController = null
      this._timerTargetTime = null
    }
  }

  private update(
    throttleTime?: null | number,
    _throttleTimeMax?: null | number | false,
    throttleFromEnd?: null | boolean,
  ): void {
    if (throttleFromEnd != null) {
      this._throttleFromEnd = throttleFromEnd
    }
    this.updateThrottleTime(throttleTime, _throttleTimeMax)
    this.updateNextCallTime()
  }

  private getCallTime(now: number): number | null {
    if (this._throttleTimeCurrent == null) {
      return null
    }

    let callTime = this._nextCallTime ?? 0

    const lastCallTime = this._lastCallTime ?? now
    const callTimeMax =
      this._throttleTimeMaxCurrent == null
        ? null
        : now + Math.max(0, this._throttleTimeMaxCurrent - (now - lastCallTime))
    if (callTimeMax != null) {
      callTime = Math.min(callTime, callTimeMax)
    }
    return callTime
  }

  private _processPromise: Promise<void> | null = null

  private async _process(): Promise<void> {
    try {
      while (true) {
        while (true) {
          this.abortSignal.throwIfAborted()

          const now = this.timeController.now()
          this._timerTargetTime = this.getCallTime(now)

          if (this._timerTargetTime == null || this._timerTargetTime <= now) {
            break
          }

          this._timerAbortController = new AbortControllerFast()
          const timerAbortSignal = combineAbortSignals(
            this._timerAbortController.signal,
            this.abortSignal,
          )
          await delay(
            this._timerTargetTime - now,
            timerAbortSignal,
            this.timeController,
          ).catch(EMPTY_FUNC)
          this.abortDelay()
        }

        if (this._timerTargetTime == null) {
          break
        }

        this._timerTargetTime = null
        this._throttleTimeCurrent = null
        this._nextCallTime = null

        if (!this._throttleFromEnd) {
          this._lastCallTime = this.timeController.now()
        }
        try {
          await super.run()
        } finally {
          if (this._throttleFromEnd) {
            this._lastCallTime = this.timeController.now()
          }
          this.updateNextCallTime()
        }
      }
    } finally {
      this._processPromise = null
    }
  }

  private process(): Promise<void> {
    if (!this._processPromise) {
      this._processPromise = this._process()
    }
    return this._processPromise
  }

  private abortDelay(): void {
    if (this._timerAbortController) {
      this._timerAbortController.abort()
      this._timerAbortController = null
    }
  }

  skipDelay(): void {
    this._nextCallTime = 0
    this.abortDelay()
  }

  abort() {
    this._throttleTimeCurrent = null
    this._throttleTimeMaxCurrent = null
    this.skipDelay()
    super.abort()
  }

  async run(options?: null | RunOptions): Promise<Result> {
    this.abortSignal.throwIfAborted()
    const { immediate, throttleTime, throttleTimeMax, throttleFromEnd } =
      options ?? {}
    this.update(immediate ? 0 : throttleTime, throttleTimeMax, throttleFromEnd)
    await this.process()
    return this.status.lastResult!
  }
}

export type CreateTaskThrottledResult<
  Args = ArgsDefault,
  Result = void,
> = CreateTaskRerunResult<Args, Result> & {
  throttled: ITaskThrottled<Args, Result>
}

export function createTaskThrottled<Args = ArgsDefault, Result = void>(
  func: TaskFunc<Args, Result>,
  args: Args,
  options?: null | TaskOptionsThrottled<Result>,
): CreateTaskThrottledResult<Args, Result> {
  const base = createTaskRerun(func, args, options)
  const throttled = new TaskThrottled(base.rerun, options)
  return {
    ...base,
    throttled,
  }
}
