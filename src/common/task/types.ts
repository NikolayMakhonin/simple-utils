import { type IObservable } from 'src/common/rx'
import { type ITimeController } from '@flemist/time-controller'
import type {
  PromiseLikeOrValue,
  PromiseOrValue,
} from 'src/common/types/common'
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
   * Determined by successPredicate, not by whether the execution threw
   * Can be non-null even if lastHasError is true
   */
  readonly lastSuccess: null | number
  /**
   * Last failure date in milliseconds
   * null - never failed
   * Determined by successPredicate, not by whether the execution threw
   * Can be non-null even if lastHasError is false
   */
  readonly lastFailed: null | number

  /**
   * When lastEnd != null:
   * true - lastError is set and lastResult is undefined
   * false - lastError is undefined and lastResult is set
   * When lastEnd == null: always false (initial state, no execution completed)
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
   * Count of consecutive successful runs since the last failure
   * Resets to 0 on failure
   * null - task never ended yet
   */
  readonly lastSuccessRuns?: null | number
  /**
   * Count of consecutive failed runs since the last success
   * Resets to 0 on success
   * null - task never ended yet
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
  /** Wait for current execution to complete */
  wait(): PromiseOrValue<void>
  /** Wait until no execution is running and no rerun is pending */
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

/** Task that inserts delays between executions */
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
