import {
  type IMessagePort,
  type WorkerClientRequest,
  WorkerClientRequestType,
  type WorkerClientResponse,
  WorkerClientResponseType,
  WorkerClientStatus,
  type WorkerConnect,
  type WorkerConnection,
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
  #connection: WorkerConnection | null = null
  #status: WorkerClientStatus = WorkerClientStatus.disconnected
  #unsubscribeAbort: Unsubscribe | null

  constructor(options: WorkerClientOptions) {
    this.#options = options

    this.#events = new Subject<WorkerClientResponse<ResponseData>>()

    this.#unsubscribeAbort =
      options.abortSignal?.subscribe(() => {
        // The worker can still run the aborted operation, so the connector learns of the abort,
        // which lets it end the worker, and the worker is released when the connection closes,
        // not at once as by close()
        this.#connection?.abort()
        void this.#closeConnection()
      }) ?? null
  }

  get status(): WorkerClientStatus {
    return this.#status
  }

  private set status(value: WorkerClientStatus) {
    if (this.#status !== value) {
      this.#status = value
      // A connection that ends without close(), closed by the worker,
      // by the port, by the connector that ended the worker, or after an abort,
      // releases the worker here,
      // before the listeners can open another connection
      if (value === WorkerClientStatus.closed) {
        this.#releaseWorker()
      }
      this.#events.emit({
        type: WorkerClientResponseType.status,
        status: this.#status,
      })
    }
  }

  private async _connect(): Promise<void> {
    // Checked without waiting, so that the connection opens within connect(),
    // and a cancel right after connect() reaches the connector through abort()
    if (this.#closePromise != null) {
      throw new WorkerError(
        WorkerErrorType.closed,
        '[WorkerClient] cannot connect after close',
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

    this.#connection = this.#options.connect(
      this.#options.connectionName,
      this.#messageChannel.port1,
      () => {
        // A worker that the connector ended sends no close,
        // and in browsers its port gives no close event
        this.#messageChannel.port2.close()
        this.status = WorkerClientStatus.closed
      },
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
    // Releases the worker at once: the worker confirms the close in a later message event,
    // and a caller that closes after the result of its operation can open its next
    // connection before that event, which must find the worker free
    this.#releaseWorker()
    return this.#closeConnection()
  }

  /** Closes the connection once; the worker is released when the connection is closed */
  #closeConnection(): Promise<void> {
    if (this.#closePromise == null) {
      this.#closePromise = this._close()
    }
    return this.#closePromise
  }

  /**
   * Tells the connector once that this connection no longer needs the worker,
   * and stops listening for the cancel, which has nothing to cancel then;
   * a client closed before it connected holds nothing to release
   */
  #releaseWorker(): void {
    const unsubscribeAbort = this.#unsubscribeAbort
    this.#unsubscribeAbort = null
    unsubscribeAbort?.()
    const connection = this.#connection
    this.#connection = null
    connection?.release()
  }

  subscribe(
    listener: Listener<WorkerClientResponse<ResponseData>>,
  ): Unsubscribe {
    return this.#events.subscribe(listener)
  }

  emit(event: WorkerClientRequest<RequestData>): PromiseOrValue<void> {
    if (this.#status !== WorkerClientStatus.connected) {
      throw new WorkerError(
        WorkerErrorType.closed,
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
