import type { TransferListItem as TransferableNode } from 'worker_threads'

/** The list of transferable types for any environment. */
export type TransferableAny = Transferable | TransferableNode

export type WorkerData<Data> = {
  data: Data
  /**
   * The list of transferable objects that should be transferred to the worker.
   * These objects will not be available in the main thread until the worker transfers them back.
   * So you can share some memory between threads without copying it.
   */
  transferList?: null | readonly TransferableAny[]
}

// region IMessagePort

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

export enum ErrorSerializedType {
  abort = 'abort',
  worker = 'worker',
  generic = 'generic',
}

export type ErrorSerialized = {
  type: ErrorSerializedType
  error: any
  props: any
}

// endregion

// region WorkerClient

export enum WorkerClientStatus {
  disconnected = 'disconnected',
  connecting = 'connecting',
  connected = 'connected',
  closing = 'closing',
  closed = 'closed',
}

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

// region WorkerServer

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

export type WorkerConnect = (
  connectionName: string,
  messagePort: IMessagePort,
) => void

export type WorkerConnectRequest = {
  type: 'connect'
  connectionName: string
  messagePort: IMessagePort
}

export type WorkerServerHandler = (messagePort: IMessagePort) => void
