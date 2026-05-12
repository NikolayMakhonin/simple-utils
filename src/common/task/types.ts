import { type IObservable } from 'src/common/rx'
import { type ITimeController } from '@flemist/time-controller'
import type {
  PromiseLikeOrValue,
  PromiseOrValue,
} from 'src/common/types/common'
import { type IAbortSignalFast } from '@flemist/abort-controller-fast'

export type ArgsDefault = void | undefined | null

export type TaskStatusBase<Result = any> = {
  readonly abortSignal: IAbortSignalFast
  readonly timeController: ITimeController
  /**
   * true - task is currently running
   */
  readonly isRunning: boolean
  /**
   * true - when task aborted during isRunning state
   */
  readonly isAborted: boolean
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
   * Reason for last failure from successPredicate
   */
  readonly lastFailedReason: any

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
  Result = any,
  Status extends TaskStatusBase<Result> = TaskStatusBase<Result>,
> extends IObservable<Status> {
  /**
   * Status reflects this task's run() as a whole,
   * including all internal stages (delays, retries, iterations, task execution, etc)
   */
  readonly status: Status
}

export type TaskRunOptionsBase = {
  readonly immediate?: null | boolean
}

export interface ITaskRun<
  Result = void,
  RunOptions extends TaskRunOptionsBase = TaskRunOptionsBase,
> {
  run(options?: null | RunOptions): Promise<Result>
  /** Abort current and scheduled executions */
  abort(): void
  /** Wait for current execution to complete */
  wait(): Promise<void>
  /** Wait until no execution is running and no rerun is pending */
  waitIdle(): Promise<void>
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

export interface ITaskRepeat {
  skipRepeat(): void
}

export type SuccessPredicateResult =
  | { readonly success: true }
  | { readonly success?: null | false; readonly reason: any }

export type TaskSuccessPredicate<
  Result = any,
  Status extends TaskStatusBase<Result> = TaskStatusBase<Result>,
> = (status: Status) => true | SuccessPredicateResult

/**
 * Action before execution and initializing action after execution
 * for a single iteration of a repeated task
 *
 * null/undefined - not set and does not overwrite previous value when merging multiple strategies
 */
export type TaskRepeatStrategyBefore<
  Result = any,
  Status extends TaskStatusBase<Result> = TaskStatusBase<Result>,
> = {
  /** Stop repeating */
  readonly stop?: null | boolean
  /** Skip task execution this iteration and go to delay directly, if delay is set */
  readonly skipRun?: null | boolean
  /**
   * Applied after execution
   *
   * - -1 - no delay
   * - 0 - delay 0 ms, like setTimeout(func, 0)
   * - number - delay in ms
   * - function - wait inside the function and N ms after
   */
  readonly delay?: null | number | TaskRepeatStrategyDelay<Result, Status>
}

/**
 * Applied after execution
 *
 * @returns additional delay and/or stop execution
 * - -1 - no delay
 * - 0 - delay 0 ms, like setTimeout(func, 0)
 * - number - delay in ms
 *
 * @param status - status of inner task execution
 */
export type TaskRepeatStrategyDelay<
  Result = any,
  Status extends TaskStatusBase<Result> = TaskStatusBase<Result>,
> = (
  status: Status,
  delayAbortSignal: IAbortSignalFast,
) => PromiseOrValue<void | undefined | null | number | TaskRepeatStrategyAfter>

/**
 * Actions after execution for a single iteration of a repeated task
 *
 * null/undefined - not set and does not overwrite previous value when merging multiple strategies
 */
export type TaskRepeatStrategyAfter = {
  /** Stop repeating */
  readonly stop?: null | boolean
  /**
   * -1 - no delay
   * 0 - delay 0 ms, like setTimeout(func, 0)
   * number - delay in ms
   */
  readonly delay?: null | number
}

/**
 * Controls repeated task behavior by deciding each iteration
 * Called before task execution with status reflecting all previous iterations
 *
 * null/undefined - not set and does not overwrite previous value when merging multiple strategies
 *
 * @param status - status of inner task execution
 */
export type TaskRepeatStrategy<
  Result = any,
  Status extends TaskStatusBase<Result> = TaskStatusBase<Result>,
> = (
  status: Status,
) => void | undefined | null | TaskRepeatStrategyBefore<Result, Status>

export type TaskFuncOptions = {
  readonly abortSignal: IAbortSignalFast
  readonly timeController: ITimeController
  readonly isFirst: boolean
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
