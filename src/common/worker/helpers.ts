import { type IObservable, type ISubject, Subject } from 'src/common/rx'
import {
  type ErrorSerialized,
  ErrorSerializedType,
  type IMessagePort,
  WorkerError,
  WorkerErrorType,
  WorkerServerResponseType,
} from './types'
import { AbortError } from '@flemist/abort-controller-fast'
import { setOwnProperty } from 'src/common/object/setOwnProperty'

/** True in a dedicated, shared or service web worker; false in a page and outside browsers */
export function isWebWorker(): boolean {
  return (
    typeof WorkerGlobalScope !== 'undefined' &&
    self instanceof WorkerGlobalScope
  )
}

// Errors are serializable out of the box in both Node and browsers,
// but not derived classes and custom properties, so we serialize them manually,
// and in deserialization we restore them.
export function serializeError(error: any): ErrorSerialized {
  const type =
    error instanceof WorkerError
      ? ErrorSerializedType.worker
      : error instanceof AbortError
        ? ErrorSerializedType.abort
        : ErrorSerializedType.generic

  return {
    type,
    error,
    props:
      error instanceof Error
        ? {
            ...error,
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
        : void 0,
  }
}

export function deserializeError(data: ErrorSerialized) {
  // A value that was no error has no props
  if (data.props == null) {
    return data.error
  }

  let error: any
  switch (data.type) {
    case ErrorSerializedType.abort:
      error = new AbortError(data.props.message, data.props.reason)
      break
    case ErrorSerializedType.worker:
      error = new WorkerError(data.props.type, data.props.message)
      break
    default:
      // A structured clone keeps an error exclusively when it is a real error object.
      // An error that Node.js passes from a worker thread is an object with the prototype
      // of an error, which the clone turns into a plain object without its message
      error =
        data.error instanceof Error ? data.error : new Error(data.props.message)
      break
  }

  for (const key in data.props) {
    if (Object.prototype.hasOwnProperty.call(data.props, key)) {
      try {
        setOwnProperty(error, key, data.props[key])
      } catch {
        // ignore read-only properties
      }
    }
  }

  return error
}

/**
 * Ends a connection that no server will serve, as a server ends it after an error:
 * the client of the port gets the error, then the close of the connection
 */
export function refuseWorkerConnection(
  messagePort: IMessagePort,
  error: unknown,
): void {
  messagePort.postMessage({
    type: WorkerServerResponseType.error,
    error: serializeError(error),
  })
  // The client waits until the connection is set up or closed.
  // The close message tells it that the connection is closed,
  // because in browsers a closed port gives the other port no close event
  messagePort.postMessage({ type: WorkerServerResponseType.close })
  messagePort.close()
}

let workerErrorsSubject: ISubject<WorkerError> | null = null

export function getWorkerFatalErrors(): IObservable<WorkerError> {
  if (workerErrorsSubject == null) {
    workerErrorsSubject = new Subject<WorkerError>({
      startStopNotifier(emit) {
        function onError(event: ErrorEvent) {
          emit(
            new WorkerError(
              WorkerErrorType.fatalError,
              `[getWorkerFatalErrors] error: ${event.message}`,
            ),
          )
        }

        function onUnhandledRejection(event: PromiseRejectionEvent) {
          emit(
            new WorkerError(
              WorkerErrorType.fatalError,
              `[getWorkerFatalErrors] error: ${event.reason}`,
            ),
          )
        }

        function onClose() {
          emit(
            new WorkerError(
              WorkerErrorType.closed,
              '[getWorkerFatalErrors] worker closed',
            ),
          )
        }

        function onNodeError(error: Error) {
          emit(
            new WorkerError(
              WorkerErrorType.fatalError,
              `[getWorkerFatalErrors] error: ${error.message}`,
            ),
          )
        }

        // Checks self instead of isWebWorker(), because a page also has self.
        // A page reports uncaught errors through the error and unhandledrejection
        // events of self, as a web worker does
        const hasSelf = typeof self !== 'undefined'
        if (hasSelf) {
          self.addEventListener('error', onError)
          self.addEventListener('unhandledrejection', onUnhandledRejection)
        } else {
          // The monitor lets Node.js end the thread after an uncaught error,
          // as it does by default, because no thread can be trusted
          // after such an error. A listener of uncaughtException
          // or unhandledRejection would keep the thread running.
          // The monitor also gets an unhandled rejection,
          // which Node.js raises as an uncaught error
          process.on('uncaughtExceptionMonitor', onNodeError)
          process.on('beforeExit', onClose)
        }

        function unsubscribe() {
          if (hasSelf) {
            self.removeEventListener('error', onError)
            self.removeEventListener('unhandledrejection', onUnhandledRejection)
          } else {
            process.off('uncaughtExceptionMonitor', onNodeError)
            process.off('beforeExit', onClose)
          }
        }

        return unsubscribe
      },
    })
  }

  return workerErrorsSubject
}

export function errorEventToWorkerError(event: ErrorEvent): WorkerError {
  // A worker whose script fails to load fires a plain Event,
  // which has none of the fields of an ErrorEvent
  let message =
    event.message ||
    '[errorEventToWorkerError] error event without a message,' +
      ' such as a worker fires when its script fails to load'
  if (event.filename) {
    message += `\n${event.filename}:${event.lineno}:${event.colno}`
  }
  const error = event.error
  if (error != null) {
    message += `\n${error.stack ?? error.message ?? error}`
  }
  return new WorkerError(WorkerErrorType.fatalError, message)
}
