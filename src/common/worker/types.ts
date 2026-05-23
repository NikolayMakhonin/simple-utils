import type { TransferListItem } from 'worker_threads'
import type { IEmitter, IObservable } from 'src/common/rx'

/** The list of transferable types for any environment. */
export type TransferableAny = Transferable | TransferListItem

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
  /**
   * When the event is response to a specific request,
   * that should deliver through this chain of proxies to the original requester.
   * If the route is empty or not provided then the event is not a response to any request, it just a signal or notification.
   */
  route?: string[]
}

export interface IWorkerEventEmitter<RequestData = any>
  extends IEmitter<WorkerEvent<RequestData>> {}
export interface IWorkerEventObservable<ResponseData = any>
  extends IObservable<WorkerEvent<ResponseData>> {}
export interface IWorkerEventBus<RequestData = any, ResponseData = any>
  extends IWorkerEventEmitter<RequestData>,
    IWorkerEventObservable<ResponseData> {}
