import type { IAbortSignalFast } from '@flemist/abort-controller-fast'
import type { WorkerData } from '../types'
import type { ISubject } from '../../rx'

// region WorkerEvent

export type WorkerEventTypeBase = 'request' | 'response' | 'event'

export type WorkerEvent<Type extends WorkerEventTypeBase, Data> = {
  type: Type
  data: WorkerData<Data>
}

// endregion

// region WorkerFunctionClient

/**
 * Single function call controller.
 */
export interface IWorkerFunctionCall<
  Output,
  EventInput extends WorkerEvent<any, any> = never,
  EventOutput extends WorkerEvent<any, any> = never,
> extends ISubject<EventOutput, EventInput> {
  /**
   * Connects to the worker and starts the function.
   * All synchronous operations in the function
   * execute until the first await,
   * so the function subscribes to its eventBus before start() resolves.
   * After start(), events can be sent to the function through emit().
   */
  start(): Promise<void>
  /**
   * Waits for the function to complete and returns the output.
   * If called without start(), starts the function automatically.
   */
  end(): Promise<WorkerData<Output>>
}

export type WorkerFunctionClientOptions<Input> = {
  data: WorkerData<Input>
  abortSignal?: null | IAbortSignalFast
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
 * const workerFunction: WorkerFunctionClient<Input, Output> = ...
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
  EventInput extends WorkerEvent<any, any> = never,
  EventOutput extends WorkerEvent<any, any> = never,
> = (
  options: WorkerFunctionClientOptions<Input>,
) => IWorkerFunctionCall<Output, EventInput, EventOutput>

// endregion

// region WorkerFunctionServer

export type WorkerFunctionServerOptions<
  Input,
  EventInput extends WorkerEvent<any, any> = never,
  EventOutput extends WorkerEvent<any, any> = never,
> = {
  data: WorkerData<Input>
  abortSignal: IAbortSignalFast
  eventBus: ISubject<EventInput, EventOutput>
}

export type WorkerFunctionServer<
  Input,
  Output,
  EventInput extends WorkerEvent<any, any> = never,
  EventOutput extends WorkerEvent<any, any> = never,
> = (
  options: WorkerFunctionServerOptions<Input, EventInput, EventOutput>,
) => Promise<WorkerData<Output>>

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

export type WorkerFunctionRequestEvent<EventInput> = {
  type: WorkerFunctionRequestType.event
  data: EventInput
}

export type WorkerFunctionRequest<Input, EventInput> =
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

export type WorkerFunctionResponseEvent<
  EventOutput extends WorkerEvent<any, any>,
> = {
  type: WorkerFunctionResponseType.event
  data: EventOutput
}

export type WorkerFunctionResponse<
  Output,
  EventOutput extends WorkerEvent<any, any>,
> =
  | WorkerFunctionResponseOutput<Output>
  | WorkerFunctionResponseEvent<EventOutput>

// endregion
