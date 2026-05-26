import {
  type IObservable,
  type ISubject,
  type Listener,
  Subject,
  waitObservable,
} from 'src/common/rx'
import type { TransferListItem as TransferableNode } from 'worker_threads'
import {
  AbortError,
  type IAbortSignalFast,
} from '@flemist/abort-controller-fast'
import type { PromiseOrValue, Unsubscribe } from 'src/common/types'
import { EMPTY_FUNC } from '../constants'

// region Simple Helpers

export function isWebWorker(): boolean {
  return typeof self === 'object' && typeof self.postMessage === 'function'
}

// endregion

// region IWorkerClient

/**
 * Creates a new WorkerServer instance in the worker and connects to it.
 * WorkerServer instance will be disposed when the connection is closed.
 * One WorkerClient binds with only one WorkerServer,
 * and one WorkerServer can only be connected by one WorkerClient.
 *
 * The goal is to create a single communication channel between
 * only one instance of a class or function call in the worker
 * and one instance in the current thread.
 * So it will virtually seem like
 * it's one instance of a class with asynchronous methods,
 * or one call of an asynchronous function in the current thread.
 * And all the work with the worker is hidden inside.
 *
 * This also allows adding a parallelizer across multiple workers,
 * or not using workers at all. All this is separated
 * from the application code and managed separately.
 */
export interface IWorkerClient<ResponseData, RequestData>
  extends ISubject<
    WorkerClientResponse<ResponseData>,
    WorkerClientRequest<RequestData>
  > {
  readonly status: WorkerClientStatus

  /** Connect to the worker only once */
  connect(): Promise<void>

  /** Close the connection forever and dispose worker resources */
  close(): Promise<void>
}

export type WorkerData<Data> = {
  data: Data
  /**
   * The list of transferable objects that should be transferred to the worker.
   * These objects will not be available in the main thread until the worker transfers them back.
   * So you can share some memory between threads without copying it.
   */
  transferList?: null | ReadonlyArray<TransferableAny>
}

export enum WorkerClientStatus {
  disconnected = 'disconnected',
  connecting = 'connecting',
  connected = 'connected',
  closing = 'closing',
  closed = 'closed',
}

// endregion

// region WorkerClientRequest

export enum WorkerClientRequestType {
  data = 'data',
  close = 'close',
}

export type WorkerClientRequestData<Data> = {
  type: WorkerClientRequestType.data
  data: WorkerData<Data>
}

export type WorkerClientRequestClose = {
  type: WorkerClientRequestType.close
}

export type WorkerClientRequest<Data> =
  | WorkerClientRequestData<Data>
  | WorkerClientRequestClose

// endregion

// region WorkerClientResponse

export enum WorkerClientResponseType {
  status = 'status',
  data = 'data',
  error = 'error',
}

export type WorkerClientResponseStatus = {
  type: WorkerClientResponseType.status
  status: WorkerClientStatus
}

export type WorkerClientResponseData<Data> = {
  type: WorkerClientResponseType.data
  data: WorkerData<Data>
}

export type WorkerClientResponseError = {
  type: WorkerClientResponseType.error
  error: any
}

export type WorkerClientResponse<Data> =
  | WorkerClientResponseStatus
  | WorkerClientResponseData<Data>
  | WorkerClientResponseError

// endregion

// region IMessagePort

/** The list of transferable types for any environment. */
export type TransferableAny = Transferable | TransferableNode

export interface IMessagePortEventMap {
  message: MessageEvent
  messageerror: MessageEvent
  close: Event
}

/**
 * Cross-platform MessagePort contract.
 * Browser and Node.js MessagePort have incompatible TypeScript type definitions
 * but identical runtime behavior for the methods described here.
 * Both platform MessagePort types can be safely cast via `as IMessagePort`.
 * The only real platform difference is the set of transferable types:
 * Node.js allows Blob, FileHandle, X509Certificate in transferList,
 * browsers do not. The close event exists only in Node.js -
 * in browsers addEventListener('close', ...) is a harmless no-op.
 */
export interface IMessagePort {
  addEventListener<Type extends keyof IMessagePortEventMap>(
    type: Type,
    listener: (event: IMessagePortEventMap[Type]) => void,
  ): void

  removeEventListener<Type extends keyof IMessagePortEventMap>(
    type: Type,
    listener: (event: IMessagePortEventMap[Type]) => void,
  ): void

  postMessage(value: any, transferList?: ReadonlyArray<TransferableAny>): void

  start(): void

  close(): void
}

// endregion

// region WorkerError

export enum WorkerErrorType {
  messageError = 'messageError',
  /** Errors after which the worker cannot continue to work and will be closed. */
  fatalError = 'fatalError',
  close = 'close',
}

export class WorkerError extends Error {
  readonly type: WorkerErrorType

  constructor(type: WorkerErrorType, message?: string) {
    super(message)
    this.type = type
  }
}

// endregion

// region serializeError / deserializeError

enum ErrorSerializedType {
  abort = 'abort',
  worker = 'worker',
  generic = 'generic',
}

type ErrorSerialized = {
  type: ErrorSerializedType
  error: any
  props: any
}

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
  return Object.assign(data.error, data.props)
}

// endregion

// region getWorkerFatalErrors

let workerErrorsSubject: ISubject<WorkerError> | null = null

export function getWorkerFatalErrors(): IObservable<WorkerError> {
  if (workerErrorsSubject == null) {
    workerErrorsSubject = new Subject<WorkerError>({
      startStopNotifier(emit) {
        function onError(event: ErrorEvent) {
          emit(
            new WorkerError(
              WorkerErrorType.fatalError,
              `[getWorkerErrors] error: ${event.message}`,
            ),
          )
        }

        function onUnhandledRejection(event: PromiseRejectionEvent) {
          emit(
            new WorkerError(
              WorkerErrorType.fatalError,
              `[getWorkerErrors] error: ${event.reason}`,
            ),
          )
        }

        function onClose() {
          emit(
            new WorkerError(
              WorkerErrorType.close,
              '[getWorkerErrors] worker closed',
            ),
          )
        }

        if (isWebWorker()) {
          self.addEventListener('error', onError)
          self.addEventListener('unhandledrejection', onUnhandledRejection)
        } else {
          process.on('unhandledRejection', onError)
          process.on('uncaughtException', onError)
          process.on('beforeExit', onClose)
        }

        function unsubscribe() {
          if (isWebWorker()) {
            self.removeEventListener('error', onError)
            self.removeEventListener('unhandledrejection', onUnhandledRejection)
          } else {
            process.off('unhandledRejection', onError)
            process.off('uncaughtException', onError)
            process.off('beforeExit', onClose)
          }
        }

        return unsubscribe
      },
    })
  }

  return workerErrorsSubject
}

// endregion

// region WorkerServerRequest

export enum WorkerServerRequestType {
  data = 'data',
  error = 'error',
  close = 'close',
}

export type WorkerServerRequestData<Data> = {
  type: WorkerServerRequestType.data
  data: WorkerData<Data>
}

export type WorkerServerRequestError = {
  type: WorkerServerRequestType.error
  error: any
}

export type WorkerServerRequestClose = {
  type: WorkerServerRequestType.close
}

export type WorkerServerRequest<Data> =
  | WorkerServerRequestData<Data>
  | WorkerServerRequestError
  | WorkerServerRequestClose

// endregion

// region WorkerServerResponse

export enum WorkerServerResponseType {
  connected = 'connected',
  data = 'data',
  error = 'error',
  close = 'close',
}

export type WorkerServerResponseConnected = {
  type: WorkerServerResponseType.connected
}

export type WorkerServerResponseData<Data> = {
  type: WorkerServerResponseType.data
  data: WorkerData<Data>
}

export type WorkerServerResponseError = {
  type: WorkerServerResponseType.error
  error: ErrorSerialized
}

export type WorkerServerResponseClose = {
  type: WorkerServerResponseType.close
}

export type WorkerServerResponse<Data> =
  | WorkerServerResponseConnected
  | WorkerServerResponseData<Data>
  | WorkerServerResponseError
  | WorkerServerResponseClose

// endregion

// region WorkerServer

export type WorkerServerOptions = {
  messagePort: IMessagePort
}

export class WorkerServer<ResponseData, RequestData>
  implements IWorkerServer<ResponseData, RequestData>
{
  readonly #options: WorkerServerOptions
  readonly #events: ISubject<WorkerServerRequest<RequestData>>
  #closed: boolean = false

  constructor(options: WorkerServerOptions) {
    this.#options = options
    this.#events = new Subject<WorkerServerRequest<RequestData>>({
      startStopNotifier: emit => {
        const { messagePort } = this.#options

        const onMessage = (event: MessageEvent) => {
          emit(event.data)
        }

        const onMessageError = () => {
          this.emit({
            type: WorkerServerResponseType.error,
            error: serializeError(
              new WorkerError(
                WorkerErrorType.messageError,
                '[WorkerServer] message error',
              ),
            ),
          })
        }

        const onClose = () => {
          emit({
            type: WorkerServerRequestType.close,
          })
        }

        const onFatalError = (error: WorkerError) => {
          emit({
            type: WorkerServerRequestType.error,
            error,
          })
          this.emit({
            type: WorkerServerResponseType.error,
            error: serializeError(error),
          })
        }

        messagePort.addEventListener('message', onMessage)
        messagePort.addEventListener('messageerror', onMessageError)
        // Fires only in Node.js; in browsers the listener is registered but never invoked
        messagePort.addEventListener('close', onClose)
        messagePort.start()

        const unsubscribeWorkerFatalErrors =
          getWorkerFatalErrors().subscribe(onFatalError)

        function unsubscribe() {
          messagePort.removeEventListener('message', onMessage)
          messagePort.removeEventListener('messageerror', onMessageError)
          messagePort.removeEventListener('close', onClose)
          unsubscribeWorkerFatalErrors()
        }

        return unsubscribe
      },
    })
    this.emit({ type: WorkerServerResponseType.connected })
  }

  subscribe(listener: Listener<WorkerServerRequest<RequestData>>): Unsubscribe {
    if (this.closed) {
      throw new Error('[WorkerServer] cannot subscribe after close')
    }
    return this.#events.subscribe(listener)
  }

  emit(data: WorkerServerResponse<ResponseData>) {
    if (this.closed) {
      throw new Error('[WorkerServer] cannot emit after close')
    }
    this.#options.messagePort.postMessage(data)
  }

  get closed() {
    return this.#closed
  }

  close() {
    if (this.closed) {
      return
    }
    this.#closed = true
    this.emit({ type: WorkerServerResponseType.close })
    this.#options.messagePort.close()
  }
}

export interface IWorkerServer<ResponseData, RequestData>
  extends ISubject<
    WorkerServerRequest<RequestData>,
    WorkerServerResponse<ResponseData>
  > {
  closed: boolean

  close(): void
}

// endregion

// region WorkerClient

export type WorkerClientOptions = {
  worker: Worker
  abortSignal?: null | IAbortSignalFast
}

export class WorkerClient<ResponseData, RequestData>
  implements IWorkerClient<ResponseData, RequestData>
{
  readonly #options: WorkerClientOptions
  readonly #events: ISubject<WorkerClientResponse<ResponseData>>
  #messageChannel: MessageChannel = null!
  #status: WorkerClientStatus = WorkerClientStatus.disconnected

  constructor(options: WorkerClientOptions) {
    this.#options = options

    this.#events = new Subject<WorkerClientResponse<ResponseData>>()
  }

  get status(): WorkerClientStatus {
    return this.#status
  }
  private set status(value: WorkerClientStatus) {
    if (this.#status !== value) {
      this.#status = value
      this.#events.emit({
        type: WorkerClientResponseType.status,
        status: this.#status,
      })
    }
  }

  #connectPromise: Promise<void> | null = null
  connect(): Promise<void> {
    if (
      this.#status === WorkerClientStatus.closing ||
      this.#status === WorkerClientStatus.closed
    ) {
      throw new Error(
        `[WorkerClient] cannot connect when status is ${this.#status}`,
      )
    }

    if (this.#connectPromise == null) {
      this.#connectPromise = waitObservable(
        this.#events,
        event => {
          return (
            event.type === WorkerClientResponseType.status &&
            event.status !== WorkerClientStatus.connecting
          )
        },
        this.#options.abortSignal,
      ).then(EMPTY_FUNC)

      const onMessage = (event: MessageEvent) => {
        const data = event.data as WorkerServerResponse<ResponseData>
        switch (data.type) {
          case WorkerServerResponseType.connected:
            this.status = WorkerClientStatus.connected
            break
          case WorkerServerResponseType.close:
            this.status = WorkerClientStatus.closed
            break
          case WorkerServerResponseType.error:
            this.#events.emit({
              type: WorkerClientResponseType.error,
              error: deserializeError(data.error),
            })
            break
          case WorkerServerResponseType.data:
            this.#events.emit({
              type: WorkerClientResponseType.data,
              data: data.data,
            })
            break
          default:
            this.#events.emit({
              type: WorkerClientResponseType.error,
              error: new WorkerError(
                WorkerErrorType.messageError,
                `[WorkerClient] unexpected message: ${JSON.stringify(data)}`,
              ),
            })
        }
      }

      const onMessageError = (event: MessageEvent) => {
        this.#events.emit({
          type: WorkerClientResponseType.error,
          error: new WorkerError(
            WorkerErrorType.messageError,
            `[WorkerClient] message error: ${event.data}`,
          ),
        })
      }

      const onClose = () => {
        this.status = WorkerClientStatus.closed
      }

      this.#messageChannel = new MessageChannel()
      this.#messageChannel.port2.addEventListener('message', onMessage)
      this.#messageChannel.port2.addEventListener(
        'messageerror',
        onMessageError,
      )
      // Fires only in Node.js; in browsers the listener is registered but never invoked
      this.#messageChannel.port2.addEventListener('close', onClose)
      this.#messageChannel.port2.start()

      this.#options.worker.postMessage(
        {
          type: 'connect',
          port: this.#messageChannel.port1,
        },
        [this.#messageChannel.port1],
      )
    }

    return this.#connectPromise
  }

  private async _close(): Promise<void> {
    if (this.#status === WorkerClientStatus.disconnected) {
      this.status = WorkerClientStatus.closed
      return
    }
    await this.#connectPromise
    if (this.#status === WorkerClientStatus.closed) {
      return
    }
    this.status = WorkerClientStatus.closing

    const closePromise = waitObservable(
      this.#events,
      event =>
        event.type === WorkerClientResponseType.status &&
        event.status === WorkerClientStatus.closed,
    ).then(EMPTY_FUNC)

    this.#messageChannel.port2.postMessage({
      type: WorkerClientRequestType.close,
    })

    await closePromise
  }

  #closePromise: Promise<void> | null = null
  close(): Promise<void> {
    if (this.#closePromise == null) {
      this.#closePromise = this._close()
    }
    return this.#closePromise
  }

  subscribe(
    listener: Listener<WorkerClientResponse<ResponseData>>,
  ): Unsubscribe {
    return this.#events.subscribe(listener)
  }

  emit(event: WorkerClientRequest<RequestData>): PromiseOrValue<void> {
    if (this.#status !== WorkerClientStatus.connected) {
      throw new Error(
        `[WorkerClient] cannot emit when status is ${this.#status}`,
      )
    }
    this.#messageChannel.port2.postMessage(event)
  }
}

// endregion
