import type { IAbortSignalFast } from '@flemist/abort-controller-fast'
import {
  type IWorkerEventBus,
  WorkerClientStatus,
  type WorkerData,
  type WorkerEvent,
} from '../types'
import type { PromiseLikeOrValue } from 'src/common/types/common'

// region WorkerFunctionClient

/**
 * Single function call controller.
 */
export interface IWorkerFunctionCall<
  Output,
  EventInput extends WorkerEvent<any> = never,
  EventOutput extends WorkerEvent<any> = never,
> extends IWorkerEventBus<EventInput, EventOutput> {
  /**
   * Connects to the worker and starts the function.
   * The function executes all synchronous operations until the first await.
   * The function is expected to subscribe to eventBus before its first await,
   * so after start() the client can call emit()
   * with a guarantee that events will be handled by the function.
   */
  start(): Promise<void>
  /**
   * Waits for the function to complete and returns the output.
   * If called without start(), starts the function automatically.
   */
  end(): Promise<WorkerData<Output>>
}

export type WorkerFunctionClientOptions<Input> = {
  readonly data: WorkerData<Input>
  readonly abortSignal?: null | IAbortSignalFast
}

/**
 * Initializes single function call controller.
 *
 * Simple usage:
 * ```ts
 * const workerFunction: WorkerFunctionClient<Input, Output> = ...
 * const output = await workerFunction({ data: inputData }).end()
 * ```
 *
 * Usage with events:
 * ```ts
 * const workerFunction: WorkerFunctionClient<
 *   Input, Output, EventInput, EventOutput
 * > = ...
 * const call = workerFunction({ data: inputData })
 * call.subscribe(event => { ... })
 * await call.start()
 * call.emit({ type: 'event', data: { data: ..., transferList: [...] } })
 * const [response1, response2] = await Promise.all([
 *   workerRequest(call, request1),
 *   workerRequest(call, request2),
 * ])
 * const output = await call.end()
 * ```
 */
export type WorkerFunctionClient<
  Input,
  Output,
  EventInput extends WorkerEvent<any> = never,
  EventOutput extends WorkerEvent<any> = never,
> = (
  options: WorkerFunctionClientOptions<Input>,
) => IWorkerFunctionCall<Output, EventInput, EventOutput>

// endregion

// region WorkerFunctionServer

export type WorkerFunctionServerOptions<
  Input,
  EventInput extends WorkerEvent<any> = never,
  EventOutput extends WorkerEvent<any> = never,
> = {
  data: WorkerData<Input>
  abortSignal: IAbortSignalFast
  eventBus: IWorkerEventBus<EventOutput, EventInput>
}

export type WorkerFunctionServer<
  Input,
  Output,
  EventInput extends WorkerEvent<any> = never,
  EventOutput extends WorkerEvent<any> = never,
> = (
  options: WorkerFunctionServerOptions<Input, EventInput, EventOutput>,
) => PromiseLikeOrValue<WorkerData<Output>>

// endregion

// region WorkerFunctionRequest

export enum WorkerFunctionRequestType {
  input = 'input',
  event = 'event',
}

export type WorkerFunctionRequestInput<Input> = {
  type: WorkerFunctionRequestType.input
  data: Input
}

export type WorkerFunctionRequestEvent<EventInput extends WorkerEvent<any>> = {
  type: WorkerFunctionRequestType.event
  data: EventInput
}

export type WorkerFunctionRequest<Input, EventInput extends WorkerEvent<any>> =
  | WorkerFunctionRequestInput<Input>
  | WorkerFunctionRequestEvent<EventInput>

// endregion

// region WorkerFunctionResponse

export enum WorkerFunctionResponseType {
  output = 'output',
  event = 'event',
}

export type WorkerFunctionResponseOutput<Output> = {
  type: WorkerFunctionResponseType.output
  data: Output
}

export type WorkerFunctionResponseEvent<EventOutput extends WorkerEvent<any>> =
  {
    type: WorkerFunctionResponseType.event
    data: EventOutput
  }

export type WorkerFunctionResponse<
  Output,
  EventOutput extends WorkerEvent<any>,
> =
  | WorkerFunctionResponseOutput<Output>
  | WorkerFunctionResponseEvent<EventOutput>

// endregion
