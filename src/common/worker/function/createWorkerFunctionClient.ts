import { EMPTY_FUNC } from 'src/common/constants'
import {
  type IWorkerFunctionCall,
  type WorkerEvent,
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

    return new WorkerFunctionCall({ client, input: callOptions.data })
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
  readonly #events = new Subject<EventOutput>()
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

    let resolveEnd: (value: WorkerData<Output>) => void
    let rejectEnd: (reason?: any) => void
    this.#endPromise = new Promise<WorkerData<Output>>((_resolve, _reject) => {
      resolveEnd = _resolve
      rejectEnd = _reject
    })
    this.#resolveEnd = resolveEnd!
    this.#rejectEnd = rejectEnd!
  }

  private onResolve(data: WorkerData<Output>): void {
    if (this.#completed) {
      return
    }
    this.#completed = true
    this.#client.close().catch(EMPTY_FUNC)
    this.#resolveEnd(data)
  }

  private onReject(reason?: any): void {
    if (this.#completed) {
      return
    }
    this.#completed = true
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
            this.onReject(
              new WorkerError(
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

    await client.connect()

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
      throw new Error('[WorkerFunctionCall] cannot emit after completion')
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
