import type {
  IWorkerEventEmitter,
  WorkerData,
  WorkerEventIntermediate,
} from './types'

export type WorkerSendArgs<Request = any> = {
  eventEmitter: IWorkerEventEmitter<Request>
  data: WorkerData<Request>
  /**
   * When provided, the event becomes a request expecting a response
   * identified by this ID. When omitted, the event is a fire-and-forget signal.
   */
  requestId?: null | string
}

/**
 * Sends a message through the event bus.
 * With requestId - a request expecting a response routed back by this ID.
 * Without requestId - a fire-and-forget signal, no response expected.
 */
export function workerSend<Request = any>({
  eventEmitter,
  data,
  requestId,
}: WorkerSendArgs<Request>) {
  const event: WorkerEventIntermediate<Request> = {
    data,
  }
  if (requestId != null) {
    event.route = [requestId]
  }
  eventEmitter.emit(event)
}
