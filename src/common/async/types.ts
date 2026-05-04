/**
The files contain several tools that are very similar in essence. Design a single, universal, flexible, and maximally simple solution or foundation - one unified tool or foundation whose capabilities (possible behaviors) cover all the capabilities of the tools in the files and more. I need maximum flexibility, maximum simplicity, maximum capability, and maximum ease of use.

The tool must satisfy all the following good design principles as much as possible: SRP, locality, flexibility, universality, growth-readiness, clarity, explicitness, simplicity, consistency, predictability, extensibility, encapsulation, modularity, testability, functional purity, evolvability, composability.

I don't need a mix, mixer or pipe of all the tools, or tools glued together. I don't need a "Swiss Army knife" either - it is the same mix. I need a unified solution or foundation that covers all of their capabilities.

Capabilities:
- Very flexible foundation for: Periodic execution, retry on condition, flexible delay between executions, stop or abort by timeout or by another event, throttling with adjustable throttling parameters, lazy one-time execution, lazy cacheable execution with any third-party cache, forced (immediate) execution, etc.
- Changeable input parameters
- AbortSignal support
- Ability to run multiple executions in parallel
- Ability to know execution start and end times via events
- etc

ONCE AGAIN, IT IS VERY IMPORTANT! I don't need a mix, mixer or pipe of all the tools, or tools glued together. I don't need a "Swiss Army knife" either - it is the same mix. I need a unified solution or foundation that covers all of their capabilities.
*/

import {
  type IObservable,
  type ISubject,
  type Listener,
  Subject,
  waitObservable,
} from '../rx'
import {
  type ITimeController,
  timeControllerDefault,
} from '@flemist/time-controller'
import {
  isPromiseLike,
  type PromiseOrValue,
  type PromiseLikeOrValue,
  promiseLikeToPromise,
  combineAbortSignals,
  delay,
  EMPTY_FUNC,
} from '@flemist/async-utils'
import {
  AbortControllerFast,
  type IAbortControllerFast,
  type IAbortSignalFast,
} from '@flemist/abort-controller-fast'
import type { TAbortReason } from '@flemist/abort-controller-fast/dist/lib/contracts'
import type { Unsubscribe } from '../types'
import { LogLevel } from '../debug'

// TODO: Result = void
export type TaskStatusBase<Result> = {
  readonly abortSignal: IAbortSignalFast
  readonly timeController: ITimeController
  readonly isRunning: boolean
  /**
   * First start date in milliseconds
   * null - never started
   */
  readonly firstStart: null | number
  /**
   * Last start date in milliseconds
   * null - never started
   */
  readonly lastStart: null | number
  /**
   * Last end date in milliseconds
   * null - never ended
   */
  readonly lastEnd: null | number
  /**
   * Last success date in milliseconds
   * null - never succeeded
   */
  readonly lastSuccess: null | number
  readonly lastHasError: boolean

  readonly lastError?: any
  readonly lastResult?: Result
  /**
   * Retry count:
   * null - no need to retry
   * 0 - zero retries yet
   * 1 - first retry
   * etc
   */
  readonly countRetry?: null | number
}

// TODO: Result = void, Status = TaskStatusBase<Result>
export interface ITaskStatus<Result, Status extends TaskStatusBase<Result>>
  extends IObservable<Status> {
  readonly status: Status
}

export type TaskRunOptionsBase = {
  immediate?: null | boolean
  isRetry?: null | boolean
}

// TODO: Result = void, RunOptions = TaskRunOptionsBase
export interface ITaskRun<Result, RunOptions extends TaskRunOptionsBase> {
  run(options?: null | RunOptions): PromiseOrValue<Result>
  /** Abort current and scheduled executions */
  abort(): void
  /** Wait for current execution or immediately scheduled execution if it supported by task */
  wait(): PromiseOrValue<void>
  /** Wait for time window without any execution or immediately scheduled executions */
  waitIdle(): PromiseOrValue<void>
  readonly abortSignal: IAbortSignalFast
  readonly timeController: ITimeController
}

// TODO: Result = void, Status = TaskStatusBase<Result>, RunOptions = TaskRunOptionsBase
export interface ITaskBase<
  Result,
  Status extends TaskStatusBase<Result>,
  RunOptions extends TaskRunOptionsBase,
> extends ITaskStatus<Result, Status>,
    ITaskRun<Result, RunOptions> {}

// TODO: Args = never
export interface ITaskArgs<Args> {
  /** Function arguments for next execution */
  args: Args
}

// TODO: Result = void, Status = TaskStatusBase<Result>, RunOptions = TaskRunOptionsBase, Args = never
export interface ITaskBaseWithArgs<
  Result,
  Status extends TaskStatusBase<Result>,
  RunOptions extends TaskRunOptionsBase,
  Args,
> extends ITaskBase<Result, Status, RunOptions>,
    ITaskArgs<Args> {}

export interface ITaskDelay {
  skipDelay(): void
}

/**
 * Guarantees that the task will be executed at least once
 * after last call of run() until next call of run() or abort()
 */
export interface ITaskRerun {
  skipRerun(): void
}

export type ITaskWithRerun<
  Result,
  Status extends TaskStatusBase<Result>,
  RunOptions extends TaskRunOptionsBase,
  Args,
> = ITaskBaseWithArgs<Result, Status, RunOptions, Args> & ITaskRerun

export type TaskRunOptionsThrottled = TaskRunOptionsBase & {
  throttleTime?: null | number
  throttleTimeMax?: null | number
}

// TODO: Result = void, Status = TaskStatusBase<Result>, RunOptions = TaskRunOptionsThrottled, Args = never
export interface ITaskThrottled<
  Result,
  Status extends TaskStatusBase<Result>,
  RunOptions extends TaskRunOptionsThrottled,
  Args,
> extends ITaskBaseWithArgs<Result, Status, RunOptions, Args>,
    ITaskDelay,
    ITaskRerun {}

export type TaskDelayResult = {
  /**
   * null - no delay
   * 0 - delay 0 ms (like setTimeout(func, 0))
   * func - custom delay
   */
  delay?: null | number | ((abortSignal: IAbortSignalFast) => Promise<any>)
  isRetry?: null | boolean
  stop?: null | boolean
  skipRun?: null | boolean
}

// TODO: Result = void, Status = TaskStatusBase<Result>
export type TaskDelay<Result, Status extends TaskStatusBase<Result>> = (
  args: Status,
) => TaskDelayResult

// TODO: Result = void, Status = TaskStatusBase<Result>
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

export type TaskFuncOptions = {
  abortSignal: IAbortSignalFast
  timeController: ITimeController
  isFirst: boolean
}

// TODO: Args = never, Result = void
export type TaskFunc<Args, Result> = (
  args: Args,
  options: TaskFuncOptions,
) => PromiseLikeOrValue<Result>

export type TaskAbortControllerOptions = {
  /** Global abort signal for all executions of the task */
  abortSignal?: null | IAbortSignalFast
}

/**
 * Reusable abort controller that creates a new abort signal after each abort
 */
export class AbortControllerReusable implements IAbortControllerFast {
  private readonly _options: null | TaskAbortControllerOptions
  private _abortController: IAbortControllerFast = null!
  private _abortSignal: IAbortSignalFast = null!

  constructor(options?: null | TaskAbortControllerOptions) {
    this._options = options ?? null
    this.resetAbortController()
  }

  private resetAbortController(): void {
    this._abortController = new AbortControllerFast()
    this._abortSignal = combineAbortSignals(
      this._abortController.signal,
      this._options?.abortSignal,
    )
  }

  abort(reason?: TAbortReason): void {
    if (this._options?.abortSignal?.aborted) {
      return
    }
    const abortController = this._abortController
    this.resetAbortController()
    abortController.abort(reason)
  }

  get signal(): IAbortSignalFast {
    return this._abortSignal
  }
}

export type ITaskWrapperSource<
  Result,
  Status extends TaskStatusBase<Result>,
  RunOptions extends TaskRunOptionsBase,
  Args,
> = ITaskBase<Result, Status, RunOptions> &
  (ITaskArgs<Args> | ITaskDelay | ITaskRerun | {})

export interface ITaskWrapper<
  Result,
  Status extends TaskStatusBase<Result>,
  RunOptions extends TaskRunOptionsBase,
  Args,
> extends ITaskBase<Result, Status, RunOptions>,
    ITaskArgs<Args>,
    ITaskDelay,
    ITaskRerun {
  readonly supportsArgs: boolean
  readonly supportsDelay: boolean
  readonly supportsRerun: boolean
}

export class TaskWrapper<
  Result,
  Status extends TaskStatusBase<Result>,
  RunOptions extends TaskRunOptionsBase,
  Args,
> implements ITaskWrapper<Result, Status, RunOptions, Args>
{
  protected readonly _task: ITaskWrapperSource<Result, Status, RunOptions, Args>
  private readonly _supportsArgs: boolean
  private readonly _supportsDelay: boolean
  private readonly _supportsRerun: boolean
  constructor(task: ITaskWrapperSource<Result, Status, RunOptions, Args>) {
    this._task = task
    this._supportsArgs = 'args' in task
    this._supportsDelay = 'skipDelay' in task
    this._supportsRerun = 'skipRerun' in task
  }

  get supportsArgs(): boolean {
    return this._supportsArgs
  }

  get supportsDelay(): boolean {
    return this._supportsDelay
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
    return this._task.status
  }

  abort(): void {
    this._task.abort()
  }

  get abortSignal(): IAbortSignalFast {
    return this._task.abortSignal
  }

  get timeController(): ITimeController {
    return this._task.timeController
  }

  subscribe(listener: Listener<Status>): Unsubscribe {
    return this._task.subscribe(listener)
  }

  run(options?: null | RunOptions): PromiseOrValue<Result> {
    return this._task.run(options)
  }

  wait(): PromiseOrValue<void> {
    return this._task.wait()
  }

  waitIdle(): PromiseOrValue<void> {
    return this._task.waitIdle()
  }

  skipDelay(): void {
    if (!this._supportsDelay) {
      return
    }
    ;(this._task as ITaskDelay).skipDelay()
  }

  skipRerun(): void {
    if (!this._supportsRerun) {
      return
    }
    ;(this._task as ITaskRerun).skipRerun()
  }
}

export type CheckIfAbortedOptions = {
  dontThrowIfAborted?: null | boolean
}

export type TaskOptionsBase = TaskAbortControllerOptions &
  CheckIfAbortedOptions & {
    readonly timeController?: null | ITimeController
    readonly logLevel?: null | LogLevel
  }

export class TaskBase<
  Result,
  Status extends TaskStatusBase<Result>,
  RunOptions extends TaskRunOptionsBase,
  Args,
> implements ITaskBaseWithArgs<Result, Status, RunOptions, Args>
{
  private readonly _options: null | TaskOptionsBase
  private readonly _func: TaskFunc<Args, Result>
  private readonly _events: ISubject<Status> = new Subject()
  private readonly _abortController: IAbortControllerFast = null!
  private readonly _timeController: ITimeController
  private readonly _wait: () => PromiseOrValue<void>
  private _args: Args
  private _status: Status
  private _runPromise: Promise<Result> | null = null

  constructor(
    func: TaskFunc<Args, Result>,
    args: Args,
    options?: null | TaskOptionsBase,
  ) {
    this._options = options ?? null
    this._func = func
    this._args = args
    this._abortController = new AbortControllerReusable(this._options)
    this._timeController =
      this._options?.timeController ?? timeControllerDefault
    this._wait = () => this.wait()
    this._status = {
      abortSignal: this._abortController.signal,
      timeController: this._timeController,
      firstStart: null,
      isRunning: false,
      lastStart: null,
      lastEnd: null,
      lastSuccess: null,
      lastHasError: false,
    } as Status
  }

  get args(): Args {
    return this._args
  }
  set args(value: Args) {
    this._args = value
  }

  get status(): Status {
    return this._status
  }

  abort(): void {
    this._abortController.abort()
  }

  get abortSignal(): IAbortSignalFast {
    return this._abortController.signal
  }

  get timeController(): ITimeController {
    return this._timeController
  }

  subscribe(listener: Listener<Status>): Unsubscribe {
    return this._events.subscribe(listener)
  }

  private onStart(options: undefined | null | RunOptions): void {
    const now = this._timeController.now()
    this._status = {
      ...this._status,
      isRunning: true,
      countRetry:
        options?.isRetry == null
          ? null
          : this._status.countRetry == null
            ? 0
            : this._status.countRetry + 1,
      firstStart: this._status.firstStart ?? now,
      lastStart: now,
      abortSignal: this._abortController.signal,
    }
    this._events.emit(this._status)
  }

  private onSuccess(result: Result): void {
    const now = this.timeController.now()
    this._status = {
      ...this._status,
      isRunning: false,
      lastEnd: now,
      lastSuccess: now,
      lastHasError: false,
      lastResult: result,
    }
    this._events.emit(this._status)
  }

  private onError(error: any): void {
    if (
      this._options?.logLevel == null ||
      this._options.logLevel >= LogLevel.error
    ) {
      console.error('[TaskBase]', error)
    }
    this._status = {
      ...this._status,
      isRunning: false,
      lastEnd: this.timeController.now(),
      lastHasError: true,
      lastError: error,
    }
    this._events.emit(this._status)
  }

  run(options?: null | RunOptions): PromiseOrValue<Result> {
    this._abortController.signal.throwIfAborted()
    if (this._runPromise) {
      return this._runPromise
    }

    const isFirst = this._status.firstStart == null
    this.onStart(options)
    try {
      const resultOrPromise = this._func(this._args, {
        abortSignal: this._abortController.signal,
        timeController: this.timeController,
        isFirst,
      })
      if (isPromiseLike(resultOrPromise)) {
        this._runPromise = promiseLikeToPromise(
          resultOrPromise.then(
            result => {
              this._runPromise = null
              this.onSuccess(result)
              return result
            },
            error => {
              this._runPromise = null
              this.onError(error)
              throw error
            },
          ),
        )
        return this._runPromise
      }
      this.onSuccess(resultOrPromise)
      return resultOrPromise
    } catch (error) {
      this.onError(error)
      throw error
    }
  }

  wait(): PromiseOrValue<void> {
    return this._runPromise?.then(EMPTY_FUNC, EMPTY_FUNC)
  }

  waitIdle(): PromiseOrValue<void> {
    if (this._runPromise) {
      return this._runPromise.then(this._wait, this._wait)
    }
  }
}

export class TaskWithRerun<
    Result,
    Status extends TaskStatusBase<Result>,
    RunOptions extends TaskRunOptionsBase,
    Args,
  >
  extends TaskWrapper<Result, Status, RunOptions, Args>
  implements ITaskWithRerun<Result, Status, RunOptions, Args>
{
  private readonly _wait: () => PromiseOrValue<void>
  private _runPromise: Promise<Result> | null = null

  constructor(task: ITaskWrapperSource<Result, Status, RunOptions, Args>) {
    super(task)
    super.subscribe(status => {
      if (!status.isRunning) {
        this._runPromise = null
      }
    })
    this._wait = () => this.wait()
  }

  run(options?: null | RunOptions): PromiseOrValue<Result> {
    this.abortSignal.throwIfAborted()
    if (this._runPromise) {
      return this._runPromise
    }

    const isRunning = this.status.isRunning
    const promiseOrResult = super.run(options)

    if (!isRunning || !isPromiseLike(promiseOrResult)) {
      return promiseOrResult
    }

    const runPromise = promiseOrResult.then(result => {
      // If rerun was skipped
      // return the result of the first run
      if (runPromise !== this._runPromise) {
        return result
      }
      return super.run(options)
    })
    this._runPromise = runPromise

    return this._runPromise
  }

  skipRerun(): void {
    this._runPromise = null
  }

  wait(): PromiseOrValue<void> {
    return this._runPromise?.then(EMPTY_FUNC, EMPTY_FUNC) ?? super.wait()
  }

  waitIdle(): PromiseOrValue<void> {
    if (this._runPromise) {
      return this._runPromise.then(this._wait, this._wait)
    }
    const promiseOrResult = super.wait()
    if (isPromiseLike(promiseOrResult)) {
      return promiseLikeToPromise(promiseOrResult).then(this._wait)
    }
  }
}

export type TaskOptionsThrottled = TaskOptionsBase & {
  readonly throttleTimeDefault?: null | number
  readonly throttleTimeMax?: null | number
}

export class TaskThrottled<
    Result,
    Status extends TaskStatusBase<Result>,
    RunOptions extends TaskRunOptionsThrottled,
    Args,
  >
  extends TaskWrapper<Result, Status, RunOptions, Args>
  implements ITaskThrottled<Result, Status, RunOptions, Args>
{
  private readonly _options: null | TaskOptionsThrottled
  private _timerAbortController: IAbortControllerFast | null = null
  private _timerTargetTime: number | null = null
  private _nextCallTime: number | null = null
  private _lastCallTime: number | null = null
  private _throttleTimeCurrent: number | null = null
  private _throttleTimeMaxCurrent: number | null = null

  constructor(
    task: ITaskWrapperSource<Result, Status, RunOptions, Args>,
    options?: null | TaskOptionsThrottled,
  ) {
    super(task)
    this._options = options ?? null
  }

  private updateThrottleTime(
    throttleTime?: null | number,
    _throttleTimeMax?: null | number | false,
  ): void {
    const throttleTimeNew =
      throttleTime ?? this._options?.throttleTimeDefault ?? 0
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
    const now = this.timeController.now()
    let newNextCallTime = now + this._throttleTimeCurrent!
    if (this._lastCallTime == null) {
      this._lastCallTime = now
    }
    if (this._throttleTimeMaxCurrent != null) {
      newNextCallTime = Math.min(
        newNextCallTime,
        this._lastCallTime + this._throttleTimeMaxCurrent,
      )
    }
    this._nextCallTime = newNextCallTime
    if (
      this._timerTargetTime != null &&
      this._nextCallTime <= this._timerTargetTime
    ) {
      this._timerAbortController!.abort()
      this._timerAbortController = null
      this._timerTargetTime = null
    }
  }

  private update(
    throttleTime?: null | number,
    _throttleTimeMax?: null | number | false,
  ): void {
    this.updateThrottleTime(throttleTime, _throttleTimeMax)
    this.updateNextCallTime()
  }

  private getCallTime(now: number): number | null {
    if (this._throttleTimeCurrent == null) {
      return null
    }

    let callTime = this._nextCallTime ?? 0

    const callTimeMax =
      this._throttleTimeMaxCurrent == null
        ? null
        : this._lastCallTime == null
          ? now + this._throttleTimeMaxCurrent
          : now +
            Math.max(
              0,
              this._throttleTimeMaxCurrent - (now - this._lastCallTime),
            )
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
        }

        if (this._timerTargetTime == null) {
          break
        }

        this._timerTargetTime = null
        this._throttleTimeCurrent = null
        this._nextCallTime = null

        try {
          await super.run()
        } finally {
          this._lastCallTime = this.timeController.now()
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

  skipDelay(): void {
    this._timerTargetTime = null
    if (this._timerAbortController) {
      this._timerAbortController.abort()
      this._timerAbortController = null
    }
  }

  abort() {
    this._throttleTimeCurrent = null
    this._throttleTimeMaxCurrent = null
    this.skipDelay()
    super.abort()
  }

  async run(options?: null | RunOptions): Promise<Result> {
    this.abortSignal.throwIfAborted()
    const { immediate, throttleTime, throttleTimeMax } = options ?? {}
    this.update(immediate ? 0 : throttleTime, throttleTimeMax)
    await this.process()
    return this.status.lastResult!
  }
}

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
  extends TaskWrapper<Result, Status, RunOptions, Args>
  implements ITaskRepeated<Result, Status, RunOptions, Args>
{
  private readonly _options: null | TaskOptionsRepeated<Result, Status>
  private _inProcess: boolean = false

  constructor(
    task: ITaskWrapperSource<Result, Status, RunOptions, Args>,
    options: TaskOptionsRepeated<Result, Status>,
  ) {
    super(task)
    this._options = options ?? null
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
          return
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
          await delay(_delay, this.abortSignal, this.timeController)
        } else if (typeof _delay === 'function') {
          await _delay()
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

    void this.process()

    const waitRerun = this.supportsRerun && this.status.isRunning
    return waitObservable(this, status => !status.isRunning).then(status => {
      if (!waitRerun) {
        return status.lastResult!
      }
      return waitObservable(this, status => !status.isRunning).then(status => {
        return status.lastResult!
      })
    })
  }
}

// For migration:
// To replace toThrottled use TaskThrottled
// To replace scheduleTaskInterval use TaskRepeated
// To replace scheduleSync use promiseAllWait
// To replace scheduleSync onError use subscribe

export function createTask<
  Result,
  Status extends TaskStatusBase<Result>,
  RunOptions extends TaskRunOptionsBase,
  Args,
>(
  func: TaskFunc<Args, Result>,
  args: Args,
  options?: null | TaskOptionsBase,
): TaskBase<Result, Status, RunOptions, Args> {
  return new TaskBase(func, args, options)
}

export function createTaskRerun<
  Result,
  Status extends TaskStatusBase<Result>,
  RunOptions extends TaskRunOptionsBase,
  Args,
>(
  task: ITaskWrapperSource<Result, Status, RunOptions, Args>,
): ITaskWithRerun<Result, Status, RunOptions, Args>
export function createTaskRerun<
  Result,
  Status extends TaskStatusBase<Result>,
  RunOptions extends TaskRunOptionsBase,
  Args,
>(
  func: TaskFunc<Args, Result>,
  args: Args,
  options?: null | TaskOptionsBase,
): ITaskWithRerun<Result, Status, RunOptions, Args>
export function createTaskRerun<
  Result,
  Status extends TaskStatusBase<Result>,
  RunOptions extends TaskRunOptionsBase,
  Args,
>(
  taskOrFunc:
    | ITaskWrapperSource<Result, Status, RunOptions, Args>
    | TaskFunc<Args, Result>,
  argsOrOptions?: Args | (null | TaskOptionsBase),
  optionsArg?: null | TaskOptionsBase,
): ITaskWithRerun<Result, Status, RunOptions, Args> {
  if (typeof taskOrFunc === 'function') {
    return new TaskWithRerun(
      new TaskBase(taskOrFunc, argsOrOptions as Args, optionsArg),
    )
  }
  return new TaskWithRerun(taskOrFunc)
}

export function createTaskThrottled<
  Result,
  Status extends TaskStatusBase<Result>,
  RunOptions extends TaskRunOptionsThrottled,
  Args,
>(
  task: ITaskWrapperSource<Result, Status, RunOptions, Args>,
  options?: null | TaskOptionsThrottled,
): ITaskThrottled<Result, Status, RunOptions, Args>
export function createTaskThrottled<
  Result,
  Status extends TaskStatusBase<Result>,
  RunOptions extends TaskRunOptionsThrottled,
  Args,
>(
  func: TaskFunc<Args, Result>,
  args: Args,
  options?: null | TaskOptionsThrottled,
): ITaskThrottled<Result, Status, RunOptions, Args>
export function createTaskThrottled<
  Result,
  Status extends TaskStatusBase<Result>,
  RunOptions extends TaskRunOptionsThrottled,
  Args,
>(
  taskOrFunc:
    | ITaskWrapperSource<Result, Status, RunOptions, Args>
    | TaskFunc<Args, Result>,
  argsOrOptions?: Args | (null | TaskOptionsThrottled),
  optionsArg?: null | TaskOptionsThrottled,
): ITaskThrottled<Result, Status, RunOptions, Args> {
  if (typeof taskOrFunc === 'function') {
    return new TaskThrottled(
      createTaskRerun(taskOrFunc, argsOrOptions as Args, optionsArg),
      optionsArg,
    )
  }
  return new TaskThrottled(
    taskOrFunc,
    argsOrOptions as null | TaskOptionsThrottled,
  )
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
