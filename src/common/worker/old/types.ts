import type { TransferListItem as TransferableNode } from 'worker_threads'
import type { IEmitter, IObservable } from 'src/common/rx'

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

export type WorkerData<Data = any> = {
  data?: Data
  /**
   * The list of transferable objects that should be transferred to the worker.
   * These objects will not be available in the main thread until the worker transfers them back.
   * So you can share some memory between threads without copying it.
   */
  transferList?: null | ReadonlyArray<TransferableAny>
}

export type WorkerEvent<Data = any> = {
  data?: WorkerData<Data>
  /**
   * Because the error and data values can be null or undefined,
   * we need to specify that the event has an error with this flag.
   */
  hasError?: boolean
  error?: any
}

export type WorkerEventIntermediate<Data = any> = WorkerEvent<Data> & {
  /**
   * When the event is response to a specific request,
   * that should deliver through this chain of proxies to the original requester.
   * If the route is empty or not provided then the event is not a response to any request, it just a signal or notification.
   */
  route?: string[]
}

export interface IWorkerEventEmitter<RequestData = any>
  extends IEmitter<WorkerEventIntermediate<RequestData>> {}
export interface IWorkerEventObservable<ResponseData = any>
  extends IObservable<WorkerEventIntermediate<ResponseData>> {}
export interface IWorkerEventBus<RequestData = any, ResponseData = any>
  extends IWorkerEventEmitter<RequestData>,
    IWorkerEventObservable<ResponseData> {}
