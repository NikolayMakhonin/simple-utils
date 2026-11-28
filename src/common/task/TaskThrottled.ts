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

export type TaskRunOptionsThrottled = TaskRunOptionsBase & ThrottleOptions

export interface ITaskThrottled<
  Args = ArgsDefault,
  Result = void,
  RunOptions extends TaskRunOptionsThrottled = TaskRunOptionsThrottled,
  Status extends TaskStatusBase<Result> = TaskStatusBase<Result>,
> extends ITaskBaseWithArgs<Args, Result, RunOptions, Status>,
    ITaskDelay,
    ITaskRerun {}

export type ThrottleOptionsTime = {
  readonly throttleTime?: null | number
  readonly throttleTimeMax?: null | number
}

export type ThrottleOptions = ThrottleOptionsTime & {
  /**
   * false/undefined - throttle time counts from the last execution start
   * true - throttle time counts from the last execution end;
   *   executes immediately when never executed or enough time passed
   */
  readonly throttleFromEnd?: null | boolean
}

export type TaskOptionsThrottled<Result = void> = TaskOptionsBase<Result> &
  ThrottleOptions

export class TaskThrottled<
    Args = ArgsDefault,
    Result = void,
    RunOptions extends TaskRunOptionsThrottled = TaskRunOptionsThrottled,
    Status extends TaskStatusBase<Result> = TaskStatusBase<Result>,
  >
  extends TaskWrapper<Args, Result, RunOptions>
  implements ITaskThrottled<Args, Result, RunOptions>
{
  readonly #options: null | TaskOptionsThrottled<Result>
  #timerAbortController: IAbortControllerFast | null = null
  #timeTimerTarget: number | null = null
  #timeNextCall: number | null = null
  #timeLastCall: number | null = null
  #throttleTimeCurrent: number | null = null
  #throttleTimeMaxCurrent: number | null = null
  #throttleFromEnd: boolean = false

  constructor(
    task: ITaskWrapperSource<Args, Result, RunOptions, Status>,
    options?: null | TaskOptionsThrottled<Result>,
  ) {
    super(task, {
      statusController: new TaskStatusControllerBase({}, options),
      logLevel: options?.logLevel,
    })
    this.#options = options ?? null
    this.#throttleFromEnd = !!this.#options?.throttleFromEnd
  }

  private updateThrottleTime(
    throttleTime?: null | number,
    throttleTimeMax?: null | number,
  ): void {
    const throttleTimeNew = throttleTime ?? this.#options?.throttleTime ?? 0
    this.#throttleTimeCurrent =
      this.#throttleTimeCurrent == null
        ? throttleTimeNew
        : Math.min(this.#throttleTimeCurrent, throttleTimeNew)
    this.#throttleTimeMaxCurrent =
      throttleTimeMax ?? this.#options?.throttleTimeMax ?? null
  }

  private updateTimeNextCall(): void {
    if (this.#throttleTimeCurrent == null) {
      return
    }
    const time = this.clock.time.value()
    let newTimeNextCall =
      this.#timeLastCall == null
        ? time
        : this.#timeLastCall + this.#throttleTimeCurrent
    if (this.#throttleTimeMaxCurrent != null) {
      const timeLastCall = this.#timeLastCall ?? time
      newTimeNextCall = Math.min(
        newTimeNextCall,
        timeLastCall + this.#throttleTimeMaxCurrent,
      )
    }
    this.#timeNextCall = newTimeNextCall
    if (
      this.#timeTimerTarget != null &&
      this.#timerAbortController != null &&
      this.#timeNextCall <= this.#timeTimerTarget
    ) {
      this.#timerAbortController.abort()
      this.#timerAbortController = null
      this.#timeTimerTarget = null
    }
  }

  private update(
    throttleTime?: null | number,
    throttleTimeMax?: null | number,
    throttleFromEnd?: null | boolean,
  ): void {
    if (throttleFromEnd != null) {
      this.#throttleFromEnd = throttleFromEnd
    }
    this.updateThrottleTime(throttleTime, throttleTimeMax)
    this.updateTimeNextCall()
  }

  #processPromise: Promise<void> | null = null

  private async _process(): Promise<void> {
    try {
      while (true) {
        while (true) {
          this.abortSignal.throwIfAborted()

          const time = this.clock.time.value()
          // A null #throttleTimeCurrent means that no run() call waits for an execution
          this.#timeTimerTarget =
            this.#throttleTimeCurrent == null ? null : this.#timeNextCall

          if (this.#timeTimerTarget == null || this.#timeTimerTarget <= time) {
            break
          }

          this.#timerAbortController = new AbortControllerFast()
          const timerAbortSignal = combineAbortSignals(
            this.#timerAbortController.signal,
            this.abortSignal,
          )
          await delay(
            this.#timeTimerTarget - time,
            timerAbortSignal,
            this.clock,
          ).catch(EMPTY_FUNC)
          this.abortDelay()
        }

        if (this.#timeTimerTarget == null) {
          break
        }

        this.#timeTimerTarget = null
        this.#throttleTimeCurrent = null
        this.#timeNextCall = null

        if (!this.#throttleFromEnd) {
          this.#timeLastCall = this.clock.time.value()
        }
        try {
          await super.runInternal()
        } finally {
          if (this.#throttleFromEnd) {
            this.#timeLastCall = this.clock.time.value()
          }
          this.updateTimeNextCall()
        }
      }
    } finally {
      this.#processPromise = null
    }
  }

  private process(): Promise<void> {
    if (!this.#processPromise) {
      this.#processPromise = this._process()
    }
    return this.#processPromise
  }

  private abortDelay(): void {
    if (this.#timerAbortController) {
      this.#timerAbortController.abort()
      this.#timerAbortController = null
    }
  }

  skipDelay(): void {
    this.#timeNextCall = 0
    this.abortDelay()
  }

  abort(reason?: any): void {
    this.#throttleTimeCurrent = null
    this.#throttleTimeMaxCurrent = null
    this.skipDelay()
    super.abort(reason)
  }

  run(options?: null | RunOptions): Promise<Result> {
    const { immediate, throttleTime, throttleTimeMax, throttleFromEnd } =
      options ?? {}
    this.update(immediate ? 0 : throttleTime, throttleTimeMax, throttleFromEnd)
    return super.run(options)
  }

  protected async runInternal(): Promise<Result> {
    await this.process()
    return this.statusInner.lastResult!
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
