import { type IObservable } from 'src/common/rx'
import { type ITimeController } from '@flemist/time-controller'
import {
  type PromiseLikeOrValue,
  type PromiseOrValue,
} from '@flemist/async-utils'
import { type IAbortSignalFast } from '@flemist/abort-controller-fast'

export type TaskStatusBase<Result = void> = {
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

export interface ITaskStatus<
  Result = void,
  Status extends TaskStatusBase<Result> = TaskStatusBase<Result>,
> extends IObservable<Status> {
  readonly status: Status
}

export type TaskRunOptionsBase = {
  immediate?: null | boolean
  isRetry?: null | boolean
}

export interface ITaskRun<
  Result = void,
  RunOptions extends TaskRunOptionsBase = TaskRunOptionsBase,
> {
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

export interface ITaskBase<
  Result = void,
  Status extends TaskStatusBase<Result> = TaskStatusBase<Result>,
  RunOptions extends TaskRunOptionsBase = TaskRunOptionsBase,
> extends ITaskStatus<Result, Status>,
    ITaskRun<Result, RunOptions> {}

export interface ITaskArgs<Args = never> {
  /** Function arguments for next execution */
  args: Args
}

export interface ITaskBaseWithArgs<
  Result = void,
  Status extends TaskStatusBase<Result> = TaskStatusBase<Result>,
  RunOptions extends TaskRunOptionsBase = TaskRunOptionsBase,
  Args = never,
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

export type TaskDelay<
  Result = void,
  Status extends TaskStatusBase<Result> = TaskStatusBase<Result>,
> = (args: Status) => TaskDelayResult

export type TaskFuncOptions = {
  abortSignal: IAbortSignalFast
  timeController: ITimeController
  isFirst: boolean
}

export type TaskFunc<Args = never, Result = void> = (
  args: Args,
  options: TaskFuncOptions,
) => PromiseLikeOrValue<Result>

// For migration:
// To replace toThrottled use TaskThrottled
// To replace scheduleTaskInterval use TaskRepeated
// To replace scheduleSync use promiseAllWait
// To replace scheduleSync onError use subscribe
