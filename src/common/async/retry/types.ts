import type { IAbortSignalFast } from '@flemist/abort-controller-fast'

export type TaskDelayArg = {
  /** Last error that occurred, or null if no error */
  error: any
  /** Retry count since last success: null = no error, 0 = first retry, 1 = second retry, etc */
  retryCount: null | number
  timeStart: number
  abortSignal: IAbortSignalFast | null
}

/**
 * Returns:
 * - null: stop execution
 * - number: delay in milliseconds
 * - () => Promise: custom async wait function
 */
export type TaskDelay = (
  args: TaskDelayArg,
) => null | (() => Promise<any>) | number
