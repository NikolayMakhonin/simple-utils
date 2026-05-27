import { type IObservable, type ISubject, Subject } from 'src/common/rx'
import {
  type ErrorSerialized,
  ErrorSerializedType,
  WorkerError,
  WorkerErrorType,
} from './types'
import { AbortError } from '@flemist/abort-controller-fast'

export function isWebWorker(): boolean {
  return typeof self === 'object' && typeof self.postMessage === 'function'
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
    props: error instanceof Error ? { ...error, name: error.name } : void 0,
  }
}

export function deserializeError(data: ErrorSerialized) {
  if (!(data.error instanceof Error)) {
    return data.error
  }

  let error: any
  switch (data.type) {
    case ErrorSerializedType.abort:
      error = new AbortError(data.error.message, data.props.reason)
      break
    case ErrorSerializedType.worker:
      error = new WorkerError(data.props.type, data.error.message)
      break
    default:
      error = data.error
      break
  }
  return Object.assign(error, data.props)
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

        function onNodeUnhandledRejection(reason: any) {
          emit(
            new WorkerError(
              WorkerErrorType.fatalError,
              `[getWorkerFatalErrors] error: ${reason}`,
            ),
          )
        }

        if (isWebWorker()) {
          self.addEventListener('error', onError)
          self.addEventListener('unhandledrejection', onUnhandledRejection)
        } else {
          process.on('unhandledRejection', onNodeUnhandledRejection)
          process.on('uncaughtException', onNodeError)
          process.on('beforeExit', onClose)
        }

        function unsubscribe() {
          if (isWebWorker()) {
            self.removeEventListener('error', onError)
            self.removeEventListener('unhandledrejection', onUnhandledRejection)
          } else {
            process.off('unhandledRejection', onNodeUnhandledRejection)
            process.off('uncaughtException', onNodeError)
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
  return new WorkerError(
    WorkerErrorType.fatalError,
    `${event.message}\n${event.filename}:${event.lineno}:${event.colno}\n${event.error?.stack ?? event.error?.message ?? event.error}`,
  )
}
