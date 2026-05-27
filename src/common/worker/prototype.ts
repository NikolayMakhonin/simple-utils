import {
  type IObservable,
  type ISubject,
  type Listener,
  Subject,
  waitObservable,
} from 'src/common/rx'
import type { TransferListItem as TransferableNode } from 'worker_threads'
import {
  AbortControllerFast,
  AbortError,
  type IAbortSignalFast,
} from '@flemist/abort-controller-fast'
import type {
  PromiseLikeOrValue,
  PromiseOrValue,
  Unsubscribe,
} from 'src/common/types'
import { EMPTY_FUNC } from 'src/common/constants'

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
export interface IWorkerClient<RequestData, ResponseData>
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
  transferList?: null | readonly TransferableAny[]
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

  postMessage(value: any, transferList?: readonly TransferableAny[]): void

  start(): void

  close(): void
}

// endregion

// region WorkerError

export enum WorkerErrorType {
  messageError = 'messageError',
  /** Errors after which the worker cannot continue to work and will be closed. */
  fatalError = 'fatalError',
  closed = 'closed',
}

export class WorkerError extends Error {
  readonly type: WorkerErrorType

  constructor(type: WorkerErrorType, message?: string) {
    super(message)
    // see: https://github.com/Microsoft/TypeScript/wiki/Breaking-Changes#extending-built-ins-like-error-array-and-map-may-no-longer-work
    Object.setPrototypeOf(this, WorkerError.prototype)
    this.name = 'WorkerError'
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

export class WorkerServer<RequestData, ResponseData>
  implements IWorkerServer<RequestData, ResponseData>
{
  readonly #options: WorkerServerOptions
  readonly #events: ISubject<WorkerServerRequest<RequestData>>
  #unsubscribeWorkerFatalErrors: Unsubscribe | null = null
  #status: WorkerServerStatus

  constructor(options: WorkerServerOptions) {
    this.#options = options
    this.#status = WorkerServerStatus.disconnected

    this.#events = new Subject<WorkerServerRequest<RequestData>>()
  }

  subscribe(listener: Listener<WorkerServerRequest<RequestData>>): Unsubscribe {
    if (this.#status === WorkerServerStatus.closed) {
      throw new Error('[WorkerServer] cannot subscribe after close')
    }
    return this.#events.subscribe(listener)
  }

  emit(event: WorkerServerResponse<ResponseData>) {
    if (this.#status !== WorkerServerStatus.connected) {
      throw new Error(
        `[WorkerServer] cannot emit when status is ${this.#status}`,
      )
    }
    const transferList =
      event.type === WorkerServerResponseType.data
        ? event.data.transferList
        : undefined
    this.#options.messagePort.postMessage(event, transferList ?? undefined)
  }

  get status() {
    return this.#status
  }

  close() {
    if (this.#status === WorkerServerStatus.closed) {
      return
    }
    this.#unsubscribeWorkerFatalErrors?.()
    if (this.#status !== WorkerServerStatus.connected) {
      // Just to send close event to the client
      this.#options.messagePort.start()
    }
    this.#status = WorkerServerStatus.closed
    this.#options.messagePort.postMessage({
      type: WorkerServerResponseType.close,
    })
    // Unsubscribe messagePort is not needed,
    // because after close the messagePort will not emit any events.
    // And also we need to catch the close event.
    this.#options.messagePort.close()
  }

  connect() {
    if (this.#status !== WorkerServerStatus.disconnected) {
      throw new Error(
        `[WorkerServer] cannot connect when status is ${this.#status}`,
      )
    }

    const onMessage = (event: MessageEvent) => {
      this.#events.emit(event.data)
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
      this.#events.emit({
        type: WorkerServerRequestType.close,
      })
    }

    const onFatalError = (error: WorkerError) => {
      this.emit({
        type: WorkerServerResponseType.error,
        error: serializeError(error),
      })
      this.#events.emit({
        type: WorkerServerRequestType.error,
        error,
      })
    }

    this.#status = WorkerServerStatus.connected

    this.#unsubscribeWorkerFatalErrors =
      getWorkerFatalErrors().subscribe(onFatalError)

    const messagePort = this.#options.messagePort
    messagePort.addEventListener('message', onMessage)
    messagePort.addEventListener('messageerror', onMessageError)
    // Fires only in Node.js; in browsers the listener is registered but never invoked
    messagePort.addEventListener('close', onClose)
    messagePort.start()

    this.emit({ type: WorkerServerResponseType.connected })
  }
}

export enum WorkerServerStatus {
  disconnected = 'disconnected',
  connected = 'connected',
  closed = 'closed',
}

export interface IWorkerServer<RequestData, ResponseData>
  extends ISubject<
    WorkerServerRequest<RequestData>,
    WorkerServerResponse<ResponseData>
  > {
  readonly status: WorkerServerStatus

  close(): void
  connect(): void
}

// endregion

// region WorkerClient

export type WorkerClientOptions = {
  connectionName: string
  connect: WorkerConnect
  abortSignal?: null | IAbortSignalFast
}

export class WorkerClient<RequestData, ResponseData>
  implements IWorkerClient<RequestData, ResponseData>
{
  readonly #options: WorkerClientOptions
  readonly #events: ISubject<WorkerClientResponse<ResponseData>>
  #messageChannel: MessageChannel = null!
  #status: WorkerClientStatus = WorkerClientStatus.disconnected

  constructor(options: WorkerClientOptions) {
    this.#options = options

    this.#events = new Subject<WorkerClientResponse<ResponseData>>()

    options.abortSignal?.subscribe(() => {
      void this.close()
    })
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

  private async _connect(): Promise<void> {
    await this.#closePromise?.catch(EMPTY_FUNC)

    if (
      this.#status === WorkerClientStatus.closing ||
      this.#status === WorkerClientStatus.closed
    ) {
      throw new Error(
        `[WorkerClient] cannot connect when status is ${this.#status}`,
      )
    }

    this.status = WorkerClientStatus.connecting

    const connectPromise = waitObservable(this.#events, event => {
      return (
        event.type === WorkerClientResponseType.status &&
        event.status !== WorkerClientStatus.connecting
      )
    }).then(EMPTY_FUNC)

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

    const onMessageError = () => {
      this.#events.emit({
        type: WorkerClientResponseType.error,
        error: new WorkerError(
          WorkerErrorType.messageError,
          '[WorkerClient] message error',
        ),
      })
    }

    const onClose = () => {
      this.status = WorkerClientStatus.closed
    }

    this.#messageChannel = new MessageChannel()
    this.#messageChannel.port2.addEventListener('message', onMessage)
    this.#messageChannel.port2.addEventListener('messageerror', onMessageError)
    // Fires only in Node.js; in browsers the listener is registered but never invoked
    this.#messageChannel.port2.addEventListener('close', onClose)
    this.#messageChannel.port2.start()

    this.#options.connect(
      this.#options.connectionName,
      this.#messageChannel.port1,
    )

    await connectPromise

    if (this.#status !== WorkerClientStatus.connected) {
      throw new WorkerError(
        WorkerErrorType.closed,
        `[WorkerClient] connection failed; status: ${this.#status}`,
      )
    }
  }

  #connectPromise: Promise<void> | null = null
  connect(): Promise<void> {
    if (this.#connectPromise == null) {
      this.#connectPromise = this._connect()
    }
    return this.#connectPromise
  }

  private async _close(): Promise<void> {
    await this.#connectPromise?.catch(EMPTY_FUNC)

    if (this.#status === WorkerClientStatus.disconnected) {
      this.status = WorkerClientStatus.closed
      return
    }
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

    this.#messageChannel.port2.close()
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
    const transferList =
      event.type === WorkerClientRequestType.data
        ? event.data.transferList
        : undefined
    const messagePort = this.#messageChannel.port2 as IMessagePort
    messagePort.postMessage(event, transferList ?? undefined)
  }
}

// endregion

export type WorkerConnect = (
  connectionName: string,
  messagePort: IMessagePort,
) => void

export type WorkerConnectPoolOptions = {
  /**
   * The worker must set up the message handler synchronously upon creation,
   * otherwise the first messages may be lost.
   */
  createWorker: (index: number) => Worker
  maxCount: number
}

/**
 * Evenly distributes connections between multiple workers,
 * creating them as needed but no more than maxCount.
 * The number of connections per worker is not limited;
 * if a worker is busy with a synchronous task,
 * the connection request will be queued.
 * Workers are not destroyed after creation and live forever
 */
export function createWorkerConnectPool(
  options: WorkerConnectPoolOptions,
): WorkerConnect {
  const pool: Worker[] = []
  let prevWorkerIndex = -1

  function getWorker(): Worker {
    prevWorkerIndex = (prevWorkerIndex + 1) % options.maxCount
    if (prevWorkerIndex >= pool.length) {
      const worker = options.createWorker(prevWorkerIndex)
      pool.push(worker)
    }
    return pool[prevWorkerIndex]
  }

  return function workerConnect(
    connectionName: string,
    messagePort: IMessagePort,
  ) {
    const worker = getWorker()
    worker.postMessage(
      {
        type: 'connect',
        name: connectionName,
        port: messagePort,
      },
      [messagePort],
    )
  }
}

export type WorkerFunctionCallback<CallbackData> = (
  data: WorkerData<CallbackData>,
) => PromiseLikeOrValue<void>

export type WorkerFunctionOptions<Input, CallbackData = never> = {
  data: WorkerData<Input>
  callback?: null | WorkerFunctionCallback<CallbackData>
  abortSignal?: null | IAbortSignalFast
}

export type WorkerFunction<Input, Output, CallbackData = never> = (
  options: WorkerFunctionOptions<Input, CallbackData>,
) => Promise<WorkerData<Output>>

export type CreateWorkerFunctionOptions = {
  connect: WorkerConnect
  connectionName: string
}

export enum WorkerFunctionRequestType {
  input = 'input',
}

export type WorkerFunctionRequest<Input> = {
  type: WorkerFunctionRequestType.input
  data: Input
}

export enum WorkerFunctionResponseType {
  output = 'output',
  callback = 'callback',
}

export type WorkerFunctionResponse<Output, CallbackData = never> =
  | {
      type: WorkerFunctionResponseType.output
      data: Output
    }
  | {
      type: WorkerFunctionResponseType.callback
      data: CallbackData
    }

export function createWorkerFunctionClient<Input, Output, CallbackData = never>(
  options: CreateWorkerFunctionOptions,
): WorkerFunction<Input, Output, CallbackData> {
  return async function workerFunction(_options) {
    const { data: input, callback, abortSignal } = _options

    const client = new WorkerClient<
      WorkerFunctionRequest<Input>,
      WorkerFunctionResponse<Output, CallbackData>
    >({
      connectionName: options.connectionName,
      connect: options.connect,
      abortSignal,
    })

    await client.connect()

    let resolve: (value: WorkerData<Output>) => void
    let reject: (reason?: any) => void
    const promise = new Promise<WorkerData<Output>>((_resolve, _reject) => {
      resolve = _resolve
      reject = _reject
    })

    let unsubscribe: Unsubscribe | null = null
    let completed = false

    function cleanUp() {
      unsubscribe?.()
      client.close().catch(EMPTY_FUNC)
    }

    function onResolve(data: WorkerData<Output>): void {
      if (completed) {
        return
      }
      completed = true
      cleanUp()
      resolve(data)
    }

    function onReject(reason?: any): void {
      if (completed) {
        return
      }
      completed = true
      cleanUp()
      reject(reason)
    }

    async function onData(
      data: WorkerData<WorkerFunctionResponse<Output, CallbackData>>,
    ): Promise<void> {
      switch (data.data.type) {
        case WorkerFunctionResponseType.output:
          onResolve({
            data: data.data.data,
            transferList: data.transferList,
          })
          break
        case WorkerFunctionResponseType.callback:
          if (callback) {
            try {
              await callback({
                data: data.data.data,
                transferList: data.transferList,
              })
            } catch (error) {
              onReject(error)
            }
          }
          break
        default:
          onReject(
            new WorkerError(
              WorkerErrorType.messageError,
              `[WorkerFunction] unexpected response: ${JSON.stringify(data)}`,
            ),
          )
          break
      }
    }

    function onError(error: any): void {
      onReject(error)
    }

    function onStatus(status: WorkerClientStatus): void {
      if (status === WorkerClientStatus.closed) {
        onReject(
          new WorkerError(
            WorkerErrorType.closed,
            '[WorkerFunction] worker closed',
          ),
        )
      }
    }

    unsubscribe = client.subscribe(event => {
      switch (event.type) {
        case WorkerClientResponseType.data:
          onData(event.data)
          break
        case WorkerClientResponseType.error:
          onError(event.error)
          break
        case WorkerClientResponseType.status:
          if (event.status === WorkerClientStatus.closed) {
            onStatus(event.status)
          }
          break
        default:
          onReject(
            new WorkerError(
              WorkerErrorType.messageError,
              `[WorkerFunction] unexpected event: ${JSON.stringify(event)}`,
            ),
          )
          break
      }
    })

    onStatus(client.status)

    client.emit({
      type: WorkerClientRequestType.data,
      data: {
        data: {
          type: WorkerFunctionRequestType.input,
          data: input.data,
        },
        transferList: input.transferList,
      },
    })

    return promise
  }
}

export type WorkerServerHandler = (messagePort: IMessagePort) => void

export type CreateWorkerFunctionServerOptions<
  Input,
  Output,
  CallbackData = never,
> = {
  func: WorkerFunction<Input, Output, CallbackData>
}

export function createWorkerFunctionServer<Input, Output, CallbackData = never>(
  options: CreateWorkerFunctionServerOptions<Input, Output, CallbackData>,
): WorkerServerHandler {
  return function workerConnect(messagePort) {
    const server = new WorkerServer<
      WorkerFunctionRequest<Input>,
      WorkerFunctionResponse<Output, CallbackData>
    >({
      messagePort,
    })

    const abortController = new AbortControllerFast()
    let running = false

    server.subscribe(async event => {
      switch (event.type) {
        case WorkerServerRequestType.data:
          if (running) {
            server.emit({
              type: WorkerServerResponseType.error,
              error: serializeError(
                new Error('[WorkerFunction] already running'),
              ),
            })
            return
          }
          running = true
          try {
            const output = await options.func({
              data: {
                data: event.data.data.data,
                transferList: event.data.transferList,
              },
              callback: callbackData => {
                server.emit({
                  type: WorkerServerResponseType.data,
                  data: {
                    data: {
                      type: WorkerFunctionResponseType.callback,
                      data: callbackData.data,
                    },
                    transferList: callbackData.transferList,
                  },
                })
              },
              abortSignal: abortController.signal,
            })

            if (server.status !== WorkerServerStatus.closed) {
              server.emit({
                type: WorkerServerResponseType.data,
                data: {
                  data: {
                    type: WorkerFunctionResponseType.output,
                    data: output.data,
                  },
                  transferList: output.transferList,
                },
              })
            }
          } catch (error) {
            if (server.status !== WorkerServerStatus.closed) {
              server.emit({
                type: WorkerServerResponseType.error,
                error: serializeError(error),
              })
            }
          } finally {
            abortController.abort()
            server.close()
          }
          break
        case WorkerServerRequestType.close:
          abortController.abort()
          // If func is running, it should handle the abort signal itself.
          // The client should wait for the function to complete.
          if (!running) {
            server.close()
          }
          break
        case WorkerServerRequestType.error:
          if (server.status !== WorkerServerStatus.closed) {
            server.emit({
              type: WorkerServerResponseType.error,
              error: serializeError(event.error),
            })
          }
          abortController.abort(event.error)
          server.close()
          break
        default: {
          const error = new WorkerError(
            WorkerErrorType.messageError,
            `[WorkerFunction] unexpected event: ${JSON.stringify(event)}`,
          )
          if (server.status !== WorkerServerStatus.closed) {
            server.emit({
              type: WorkerServerResponseType.error,
              error: serializeError(error),
            })
          }
          abortController.abort(error)
          server.close()
          break
        }
      }
    })

    server.connect()
  }
}
