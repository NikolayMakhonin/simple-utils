import { type ISubject, type Listener, Subject } from 'src/common/rx'
import {
  type IMessagePort,
  WorkerError,
  WorkerErrorType,
  type WorkerServerRequest,
  WorkerServerRequestType,
  type WorkerServerResponse,
  WorkerServerResponseType,
} from './types'
import type { Unsubscribe } from 'src/common/types'
import { getWorkerFatalErrors, serializeError } from './helpers'

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

  get status(): WorkerServerStatus {
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
