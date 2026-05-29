import { AbortControllerFast } from '@flemist/abort-controller-fast'
import {
  type WorkerEvent,
  type WorkerFunctionServer,
  type WorkerFunctionRequest,
  type WorkerFunctionRequestInput,
  WorkerFunctionRequestType,
  type WorkerFunctionResponse,
  WorkerFunctionResponseType,
} from './types'
import {
  type WorkerData,
  WorkerError,
  WorkerErrorType,
  type WorkerServerHandler,
  WorkerServerRequestType,
  WorkerServerResponseType,
} from '../types'
import { serializeError } from '../helpers'
import { WorkerServer, WorkerServerStatus } from '../WorkerServer'
import { Subject } from 'src/common/rx'

export type CreateWorkerFunctionServerOptions<
  Input,
  Output,
  EventInput extends WorkerEvent<any> = never,
  EventOutput extends WorkerEvent<any> = never,
> = {
  func: WorkerFunctionServer<Input, Output, EventInput, EventOutput>
}

export function createWorkerFunctionServer<
  Input,
  Output,
  EventInput extends WorkerEvent<any> = never,
  EventOutput extends WorkerEvent<any> = never,
>(
  options: CreateWorkerFunctionServerOptions<
    Input,
    Output,
    EventInput,
    EventOutput
  >,
): WorkerServerHandler {
  return function workerConnect(messagePort) {
    const server = new WorkerServer<
      WorkerFunctionRequest<Input, EventInput>,
      WorkerFunctionResponse<Output, EventOutput>
    >({
      messagePort,
    })

    const abortController = new AbortControllerFast()
    let running = false

    const eventBus = new Subject<EventInput>()

    async function runFunc(
      data: WorkerData<WorkerFunctionRequestInput<Input>>,
    ): Promise<void> {
      running = true

      try {
        const output = await options.func({
          data: {
            data: data.data.data,
            transferList: data.transferList,
          },
          eventBus: {
            subscribe: listener => eventBus.subscribe(listener),
            emit(event) {
              if (server.status === WorkerServerStatus.closed) {
                return
              }
              server.emit({
                type: WorkerServerResponseType.data,
                data: {
                  data: {
                    type: WorkerFunctionResponseType.event,
                    data: event,
                  },
                  transferList:
                    'data' in event ? event.data.transferList : undefined,
                },
              })
            },
          },
          abortSignal: abortController.signal,
        })

        if (server.status !== WorkerServerStatus.closed) {
          server.emit({
            type: WorkerServerResponseType.data,
            data: {
              data: {
                type: WorkerFunctionResponseType.output,
                data: output.data,
              },
              transferList: output.transferList,
            },
          })
        }
      } catch (error) {
        if (server.status !== WorkerServerStatus.closed) {
          server.emit({
            type: WorkerServerResponseType.error,
            error: serializeError(error),
          })
        }
      } finally {
        abortController.abort()
        server.close()
      }
    }

    server.subscribe(event => {
      switch (event.type) {
        case WorkerServerRequestType.data: {
          if (server.status === WorkerServerStatus.closed) {
            return
          }
          switch (event.data.data.type) {
            case WorkerFunctionRequestType.input:
              if (running) {
                server.emit({
                  type: WorkerServerResponseType.error,
                  error: serializeError(
                    new Error('[createWorkerFunctionServer] already running'),
                  ),
                })
                return
              }
              void runFunc(
                event.data as WorkerData<WorkerFunctionRequestInput<Input>>,
              )
              break
            case WorkerFunctionRequestType.event:
              eventBus.emit(event.data.data.data)
              break
            default:
              server.emit({
                type: WorkerServerResponseType.error,
                error: serializeError(
                  new WorkerError(
                    WorkerErrorType.messageError,
                    `[createWorkerFunctionServer] unexpected request: ${JSON.stringify(event.data)}`,
                  ),
                ),
              })
              break
          }
          break
        }
        case WorkerServerRequestType.close:
          abortController.abort()
          // If func is running, it should handle the abort signal itself.
          // The client should wait for the function to complete.
          if (!running) {
            server.close()
          }
          break
        case WorkerServerRequestType.error:
          if (server.status !== WorkerServerStatus.closed) {
            server.emit({
              type: WorkerServerResponseType.error,
              error: serializeError(event.error),
            })
          }
          abortController.abort(event.error)
          server.close()
          break
        default: {
          const error = new WorkerError(
            WorkerErrorType.messageError,
            `[createWorkerFunctionServer] unexpected event: ${JSON.stringify(event)}`,
          )
          if (server.status !== WorkerServerStatus.closed) {
            server.emit({
              type: WorkerServerResponseType.error,
              error: serializeError(error),
            })
          }
          abortController.abort(error)
          server.close()
          break
        }
      }
    })

    server.connect()
  }
}
