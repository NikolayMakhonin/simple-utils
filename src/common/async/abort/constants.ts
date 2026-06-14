import { AbortError } from '@flemist/abort-controller-fast'

export const SUPPRESS_ABORT_ERROR = (error: unknown) => {
  if (error instanceof AbortError) {
    return
  }
  throw error
}
