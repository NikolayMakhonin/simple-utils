import {
  AbortControllerFast,
  type IAbortSignalFast,
} from '@flemist/abort-controller-fast'
import { EMPTY_FUNC } from 'src/common/constants'
import { promiseToAbortable } from 'src/common/async/abort/promiseToAbortable'
import {
  type IWorkerFunctionCall,
  type WorkerFunctionClient,
  type WorkerFunctionRequest,
  WorkerFunctionRequestType,
  type WorkerFunctionResponse,
  WorkerFunctionResponseType,
} from './types'
import {
  WorkerClientRequestType,
  WorkerClientResponseType,
  WorkerClientStatus,
  type WorkerConnect,
  type WorkerData,
  WorkerError,
  WorkerErrorType,
  type WorkerEvent,
} from '../types'
import { type IWorkerClient, WorkerClient } from '../WorkerClient'
import { type Listener, Subject } from 'src/common/rx'
import type { PromiseOrValue, Unsubscribe } from 'src/common/types'

export type CreateWorkerFunctionClientOptions = {
  connect: WorkerConnect
  connectionName: string
}

export function createWorkerFunctionClient<
  Input,
  Output,
  EventInput extends WorkerEvent<any> = never,
  EventOutput extends WorkerEvent<any> = never,
>(
  createOptions: CreateWorkerFunctionClientOptions,
): WorkerFunctionClient<Input, Output, EventInput, EventOutput> {
  return function workerFunction(
    callOptions,
  ): IWorkerFunctionCall<Output, EventInput, EventOutput> {
    const client = new WorkerClient<
      WorkerFunctionRequest<Input, EventInput>,
      WorkerFunctionResponse<Output, EventOutput>
    >({
      connectionName: createOptions.connectionName,
      connect: createOptions.connect,
      abortSignal: callOptions.abortSignal,
    })

    return new WorkerFunctionCall({
      client,
      input: callOptions.data,
      abortSignal: callOptions.abortSignal,
    })
  }
}

export type WorkerFunctionCallOptions<
  Input,
  Output,
  EventInput extends WorkerEvent<any>,
  EventOutput extends WorkerEvent<any>,
> = {
  readonly client: IWorkerClient<
    WorkerFunctionRequest<Input, EventInput>,
    WorkerFunctionResponse<Output, EventOutput>
  >
  readonly input: WorkerData<Input>
  readonly abortSignal?: null | IAbortSignalFast
}

export class WorkerFunctionCall<
  Input,
  Output,
  EventInput extends WorkerEvent<any>,
  EventOutput extends WorkerEvent<any>,
> implements IWorkerFunctionCall<Output, EventInput, EventOutput>
{
  readonly #client: IWorkerClient<
    WorkerFunctionRequest<Input, EventInput>,
    WorkerFunctionResponse<Output, EventOutput>
  >
  #input: WorkerData<Input> | null
  /**
   * The cancel of the caller, read directly, because the connection can close
   * because of the cancel before the call reacts to the cancel
   */
  readonly #abortSignal: IAbortSignalFast | null
  readonly #events = new Subject<EventOutput>()
  readonly #abortController = new AbortControllerFast()
  readonly #unsubscribeAbort: Unsubscribe | null
  readonly #resolveEnd: (value: WorkerData<Output>) => void
  readonly #rejectEnd: (reason?: any) => void
  readonly #endPromise: Promise<WorkerData<Output>>
  #started = false
  #completed = false

  constructor(
    options: WorkerFunctionCallOptions<Input, Output, EventInput, EventOutput>,
  ) {
    this.#client = options.client
    this.#input = options.input
    this.#abortSignal = options.abortSignal ?? null

    this.#unsubscribeAbort =
      options.abortSignal?.subscribe(reason => {
        this.#abortController.abort(reason)
      }) ?? null

    let resolveEnd: (value: WorkerData<Output>) => void
    let rejectEnd: (reason?: any) => void
    this.#endPromise = new Promise<WorkerData<Output>>((_resolve, _reject) => {
      resolveEnd = _resolve
      rejectEnd = _reject
    })
    this.#resolveEnd = resolveEnd!
    this.#rejectEnd = rejectEnd!
    // Prevent unhandled rejection in case the caller doesn't run end()
    this.#endPromise.catch(EMPTY_FUNC)
  }

  get abortSignal(): IAbortSignalFast {
    return this.#abortController.signal
  }

  private onResolve(data: WorkerData<Output>): void {
    if (this.#completed) {
      return
    }
    this.#completed = true
    this.#unsubscribeAbort?.()
    this.#abortController.abort()
    this.#client.close().catch(EMPTY_FUNC)
    this.#resolveEnd(data)
  }

  private onReject(reason?: any): void {
    if (this.#completed) {
      return
    }
    this.#completed = true
    this.#unsubscribeAbort?.()
    this.#abortController.abort(reason)
    this.#client.close().catch(EMPTY_FUNC)
    this.#rejectEnd(reason)
  }

  async start(): Promise<void> {
    if (this.#started) {
      return
    }
    this.#started = true

    const client = this.#client

    client.subscribe(event => {
      switch (event.type) {
        case WorkerClientResponseType.data: {
          const response = event.data.data
          switch (response.type) {
            case WorkerFunctionResponseType.output:
              this.onResolve({
                data: response.data,
                transferList: event.data.transferList,
              })
              break
            case WorkerFunctionResponseType.event:
              this.#events.emit(response.data)
              break
            default:
              this.onReject(
                new WorkerError(
                  WorkerErrorType.messageError,
                  `[WorkerFunctionCall] unexpected response type: ${JSON.stringify(event.data)}`,
                ),
              )
              break
          }
          break
        }
        case WorkerClientResponseType.error:
          this.onReject(event.error)
          break
        case WorkerClientResponseType.status:
          if (event.status === WorkerClientStatus.closed) {
            // A connector can close the connection of a cancelled call by ending its worker
            const abortSignal = this.#abortSignal
            this.onReject(
              abortSignal?.aborted
                ? abortSignal.reason
                : new WorkerError(
                    WorkerErrorType.closed,
                    '[WorkerFunctionCall] worker closed',
                  ),
            )
          }
          break
        default:
          this.onReject(
            new WorkerError(
              WorkerErrorType.messageError,
              `[WorkerFunctionCall] unexpected event: ${JSON.stringify(event)}`,
            ),
          )
          break
      }
    })

    const abortSignal = this.#abortSignal
    if (!abortSignal?.aborted) {
      try {
        // Raced with the cancel, because a worker busy with a synchronous task sets up
        // the connection exclusively after that task, and a cancelled call must end at once
        await promiseToAbortable(abortSignal, client.connect())
      } catch (error) {
        // A cancel ends the call below, whether the race or the connector,
        // which can end the worker of a cancelled call, rejected the connect.
        // A call that the worker ended with an error while it connected keeps that error,
        // which tells more than the failed connect, such as a name that the worker lacks
        if (!abortSignal?.aborted && !this.#completed) {
          throw error
        }
      }
    }
    // A call cancelled before its connection is set up must not start in the worker.
    // A worker busy with a synchronous task sets up the connection only after that task,
    // so it would run the cancelled call after it, to its end
    if (abortSignal?.aborted) {
      this.onReject(abortSignal.reason)
    }
    // A call that ended while it connected, by the cancel or by the worker, sends nothing
    if (this.#completed) {
      return
    }

    const input = this.#input!
    this.#input = null
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
  }
  async end(): Promise<WorkerData<Output>> {
    await this.start()
    return this.#endPromise
  }
  subscribe(listener: Listener<EventOutput>): Unsubscribe {
    return this.#events.subscribe(listener)
  }

  emit(event: EventInput): PromiseOrValue<void> {
    if (!this.#started) {
      throw new Error('[WorkerFunctionCall] cannot emit before start()')
    }
    if (this.#completed) {
      throw new WorkerError(
        WorkerErrorType.closed,
        '[WorkerFunctionCall] cannot emit after completion',
      )
    }
    this.#sendEvent(event)
  }

  #sendEvent(event: EventInput): void {
    this.#client.emit({
      type: WorkerClientRequestType.data,
      data: {
        data: {
          type: WorkerFunctionRequestType.event,
          data: event,
        },
        transferList: 'data' in event ? event.data.transferList : undefined,
      },
    })
  }
}
