import {
  type IMessagePort,
  type WorkerClientRequest,
  WorkerClientRequestType,
  type WorkerClientResponse,
  WorkerClientResponseType,
  WorkerClientStatus,
  type WorkerConnect,
  WorkerError,
  WorkerErrorType,
  type WorkerServerResponse,
  WorkerServerResponseType,
} from './types'
import type { IAbortSignalFast } from '@flemist/abort-controller-fast'
import {
  type ISubject,
  type Listener,
  Subject,
  waitObservable,
} from 'src/common/rx'
import { EMPTY_FUNC } from 'src/common/constants'
import type { PromiseOrValue, Unsubscribe } from 'src/common/types'

import { deserializeError } from './helpers'

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
