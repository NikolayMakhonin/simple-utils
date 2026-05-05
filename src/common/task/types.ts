import { type IObservable } from 'src/common/rx'
import { type ITimeController } from '@flemist/time-controller'
import {
  type PromiseLikeOrValue,
  type PromiseOrValue,
} from '@flemist/async-utils'
import { type IAbortSignalFast } from '@flemist/abort-controller-fast'

export type ArgsDefault = void | undefined | null

export type TaskStatusBase<Result = void> = {
  readonly abortSignal: IAbortSignalFast
  readonly timeController: ITimeController
  /**
   * true - task is currently running
   */
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
   * if lastEnd != null then at least lastResult or lastError is present
   */
  readonly lastEnd: null | number
  /**
   * Last success date in milliseconds
   * null - never succeeded
   * lastSuccess is just the result of successPredicate of last status
   * Note: lastSuccess can be true even if lastHasError is true
   */
  readonly lastSuccess: null | number
  /**
   * Last not success date in milliseconds
   * null - never failed
   * lastFailed is just the result of !successPredicate of last status
   * Note: lastFailed can be true even if lastHasError is false
   */
  readonly lastFailed: null | number

  /**
   * true - lastError is set and lastResult is undefined
   * false - lastError is undefined and lastResult is set
   */
  readonly lastHasError: boolean

  /**
   * If lastHasError is false then lastError is undefined
   *
   * Note that lastError can be undefined even if lastHasError is true
   * in the `throw undefined` case
   */
  readonly lastError?: any
  /**
   * If lastHasError is true then lastResult is undefined
   */
  readonly lastResult?: Result
  /**
   * Count of successful runs from the last failed
   */
  readonly lastSuccessRuns?: null | number
  /**
   * Count of failed runs from the last success
   */
  readonly lastFailedRuns?: null | number
}

export interface ITaskStatus<
  Result = void,
  Status extends TaskStatusBase<Result> = TaskStatusBase<Result>,
> extends IObservable<Status> {
  readonly status: Status
}

export type TaskRunOptionsBase = {
  immediate?: null | boolean
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
  RunOptions extends TaskRunOptionsBase = TaskRunOptionsBase,
  Status extends TaskStatusBase<Result> = TaskStatusBase<Result>,
> extends ITaskStatus<Result, Status>,
    ITaskRun<Result, RunOptions> {}

export interface ITaskArgs<Args = ArgsDefault> {
  /** Function arguments for next execution */
  args: Args
}

export interface ITaskBaseWithArgs<
  Args = ArgsDefault,
  Result = void,
  RunOptions extends TaskRunOptionsBase = TaskRunOptionsBase,
  Status extends TaskStatusBase<Result> = TaskStatusBase<Result>,
> extends ITaskBase<Result, RunOptions, Status>,
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

export const TASK_STOP = 'stop'
export type TaskStop = typeof TASK_STOP

export type TaskDelay<
  Result = void,
  Status extends TaskStatusBase<Result> = TaskStatusBase<Result>,
> =
  | {
      /**
       * null or undefined - no delay
       * 0 - delay 0 ms (like setTimeout(func, 0))
       * func - custom delay
       */
      delay?:
        | null
        | number
        | ((
            status: Status,
            delayAbortSignal: IAbortSignalFast,
          ) => PromiseOrValue<undefined | null | number | TaskStop>)
      skipRun?: null | boolean
    }
  | TaskStop

export type TaskDelayPrepare<
  Result = void,
  Status extends TaskStatusBase<Result> = TaskStatusBase<Result>,
> = (status: Status) => TaskDelay<Result, Status>

export type TaskFuncOptions = {
  abortSignal: IAbortSignalFast
  timeController: ITimeController
  isFirst: boolean
}

export type TaskFunc<Args = ArgsDefault, Result = void> = (
  args: Args,
  options: TaskFuncOptions,
) => PromiseLikeOrValue<Result>

// For migration:
// To replace toThrottled use TaskThrottled
// To replace scheduleTaskInterval use TaskRepeated
// To replace scheduleSync use promiseAllWait
// To replace scheduleSync onError use subscribe
