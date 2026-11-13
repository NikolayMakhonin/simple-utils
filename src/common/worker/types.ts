import type { TransferListItem as TransferableNode } from 'worker_threads'
import type { ISubject } from '../rx'
import type { IAbortSignalFast } from '@flemist/abort-controller-fast'
import type { EnumOf } from 'src/common/types/common'

/** The list of transferable types for any environment. */
export type TransferableAny = Transferable | TransferableNode

export type WorkerData<Data> = {
  readonly data: Data
  /**
   * The list of transferable objects that should be transferred to the worker.
   * These objects will not be available in the main thread until the worker transfers them back.
   * So you can share some memory between threads without copying it.
   */
  readonly transferList?: null | readonly TransferableAny[]
}

// region IWorker

export interface IWorker {
  postMessage(message: any, transfer: TransferableAny[]): void

  on(event: 'error', listener: (err: Error) => void): this

  on(event: 'message', listener: (value: any) => void): this

  on(event: 'messageerror', listener: (error: Error) => void): this

  off(event: 'error', listener: (err: Error) => void): this

  off(event: 'message', listener: (value: any) => void): this

  off(event: 'messageerror', listener: (error: Error) => void): this

  terminate(): Promise<void>
}

// endregion

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

  postMessage(
    value: any,
    transferList?: null | readonly TransferableAny[],
  ): void

  start(): void

  close(): void
}

// endregion

// region WorkerError

export type WorkerErrorType = EnumOf<typeof WorkerErrorType>
export const WorkerErrorType = {
  messageError: 'messageError',
  /** Errors after which the worker cannot continue to work and will be closed. */
  fatalError: 'fatalError',
  closed: 'closed',
} as const

export class WorkerError extends Error {
  readonly type: WorkerErrorType

  constructor(type: WorkerErrorType, message?: null | string) {
    super(message ?? undefined)
    // see: https://github.com/Microsoft/TypeScript/wiki/Breaking-Changes#extending-built-ins-like-error-array-and-map-may-no-longer-work
    Object.setPrototypeOf(this, WorkerError.prototype)
    this.name = 'WorkerError'
    this.type = type
  }
}

export type ErrorSerializedType = EnumOf<typeof ErrorSerializedType>
export const ErrorSerializedType = {
  abort: 'abort',
  worker: 'worker',
  generic: 'generic',
} as const

export type ErrorSerialized = {
  type: ErrorSerializedType
  error: any
  props: any
}

// endregion

// region WorkerClient

export type WorkerClientStatus = EnumOf<typeof WorkerClientStatus>
export const WorkerClientStatus = {
  disconnected: 'disconnected',
  connecting: 'connecting',
  connected: 'connected',
  closing: 'closing',
  closed: 'closed',
} as const

export type WorkerClientRequestType = EnumOf<typeof WorkerClientRequestType>
export const WorkerClientRequestType = {
  data: 'data',
  close: 'close',
} as const

export type WorkerClientRequestData<Data> = {
  type: typeof WorkerClientRequestType.data
  data: WorkerData<Data>
}
export type WorkerClientRequestClose = {
  type: typeof WorkerClientRequestType.close
}
export type WorkerClientRequest<Data> =
  | WorkerClientRequestData<Data>
  | WorkerClientRequestClose

export type WorkerClientResponseType = EnumOf<typeof WorkerClientResponseType>
export const WorkerClientResponseType = {
  status: 'status',
  data: 'data',
  error: 'error',
} as const

export type WorkerClientResponseStatus = {
  type: typeof WorkerClientResponseType.status
  status: WorkerClientStatus
}
export type WorkerClientResponseData<Data> = {
  type: typeof WorkerClientResponseType.data
  data: WorkerData<Data>
}
export type WorkerClientResponseError = {
  type: typeof WorkerClientResponseType.error
  error: any
}
export type WorkerClientResponse<Data> =
  | WorkerClientResponseStatus
  | WorkerClientResponseData<Data>
  | WorkerClientResponseError

// endregion

// region WorkerServer

export type WorkerServerRequestType = EnumOf<typeof WorkerServerRequestType>
export const WorkerServerRequestType = {
  data: 'data',
  error: 'error',
  close: 'close',
} as const

export type WorkerServerRequestData<Data> = {
  type: typeof WorkerServerRequestType.data
  data: WorkerData<Data>
}
export type WorkerServerRequestError = {
  type: typeof WorkerServerRequestType.error
  error: any
}
export type WorkerServerRequestClose = {
  type: typeof WorkerServerRequestType.close
}
export type WorkerServerRequest<Data> =
  | WorkerServerRequestData<Data>
  | WorkerServerRequestError
  | WorkerServerRequestClose

export type WorkerServerResponseType = EnumOf<typeof WorkerServerResponseType>
export const WorkerServerResponseType = {
  connected: 'connected',
  data: 'data',
  error: 'error',
  close: 'close',
} as const

export type WorkerServerResponseConnected = {
  type: typeof WorkerServerResponseType.connected
}
export type WorkerServerResponseData<Data> = {
  type: typeof WorkerServerResponseType.data
  data: WorkerData<Data>
}
export type WorkerServerResponseError = {
  type: typeof WorkerServerResponseType.error
  error: ErrorSerialized
}
export type WorkerServerResponseClose = {
  type: typeof WorkerServerResponseType.close
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
  /**
   * Offset of timeControllerDefault in the connecting thread.
   * The worker sets it on its own timeControllerDefault,
   * so that now() in the worker matches now() in the connecting thread
   */
  timeControllerOffset: number | null
  /** The offsetDate of timeControllerDefault in the connecting thread, set the same way */
  timeControllerOffsetDate: number | null
}

export type WorkerServerHandler = (messagePort: IMessagePort) => void

// region WorkerEvent

export type WorkerEventRequest<Data> = {
  type: 'request'
  requestId: number
  data: WorkerData<Data>
}

export type WorkerEventResponse<Data> = {
  type: 'response'
  requestId: number
  data: WorkerData<Data>
}

export type WorkerEventResponseError = {
  type: 'responseError'
  requestId: number
  error: ErrorSerialized
}

export type WorkerEventFire<Data> = {
  type: 'event'
  data: WorkerData<Data>
}

export type WorkerEvent<Data> =
  | WorkerEventRequest<Data>
  | WorkerEventResponse<Data>
  | WorkerEventResponseError
  | WorkerEventFire<Data>

export interface IWorkerEventBus<
  EventInput extends WorkerEvent<any> = never,
  EventOutput extends WorkerEvent<any> = never,
> extends ISubject<EventOutput, EventInput> {
  readonly abortSignal: IAbortSignalFast
}

// endregion
