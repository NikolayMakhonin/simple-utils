import { AbortControllerFast } from '@flemist/abort-controller-fast'
import {
  type WorkerFunction,
  type WorkerFunctionRequest,
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

export type CreateWorkerFunctionServerOptions<
  Input,
  Output,
  CallbackData = never,
> = {
  func: WorkerFunction<Input, Output, CallbackData>
}

export function createWorkerFunctionServer<Input, Output, CallbackData = never>(
  options: CreateWorkerFunctionServerOptions<Input, Output, CallbackData>,
): WorkerServerHandler {
  return function workerConnect(messagePort) {
    const server = new WorkerServer<
      WorkerFunctionRequest<Input>,
      WorkerFunctionResponse<Output, CallbackData>
    >({
      messagePort,
    })

    const abortController = new AbortControllerFast()
    let running = false

    async function runFunc(
      data: WorkerData<WorkerFunctionRequest<Input>>,
    ): Promise<void> {
      running = true

      try {
        const output = await options.func({
          data: {
            data: data.data.data,
            transferList: data.transferList,
          },
          callback: callbackData => {
            server.emit({
              type: WorkerServerResponseType.data,
              data: {
                data: {
                  type: WorkerFunctionResponseType.callback,
                  data: callbackData.data,
                },
                transferList: callbackData.transferList,
              },
            })
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
          // Use middleware variable because of TypeScript type check bug
          const statusBeforeRunning = server.status
          if (statusBeforeRunning === WorkerServerStatus.closed) {
            return
          }
          if (running) {
            server.emit({
              type: WorkerServerResponseType.error,
              error: serializeError(
                new Error('[WorkerFunction] already running'),
              ),
            })
            return
          }
          if (event.data.data.type !== WorkerFunctionRequestType.input) {
            server.emit({
              type: WorkerServerResponseType.error,
              error: serializeError(
                new Error(
                  `[WorkerFunction] unexpected request: ${JSON.stringify(
                    event.data,
                  )}`,
                ),
              ),
            })
            return
          }

          void runFunc(event.data)
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
            `[WorkerFunction] unexpected event: ${JSON.stringify(event)}`,
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
