import type { Unsubscribe } from 'src/common/types'
import { EMPTY_FUNC } from 'src/common/constants'
import {
  type WorkerFunction,
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
import { WorkerClient } from '../WorkerClient'

export type CreateWorkerFunctionOptions = {
  connect: WorkerConnect
  connectionName: string
}

export function createWorkerFunctionClient<Input, Output, CallbackData = never>(
  options: CreateWorkerFunctionOptions,
): WorkerFunction<Input, Output, CallbackData> {
  return async function workerFunction(_options) {
    const { data: input, callback, abortSignal } = _options

    const client = new WorkerClient<
      WorkerFunctionRequest<Input>,
      WorkerFunctionResponse<Output, CallbackData>
    >({
      connectionName: options.connectionName,
      connect: options.connect,
      abortSignal,
    })

    await client.connect()

    let resolve: (value: WorkerData<Output>) => void
    let reject: (reason?: any) => void
    const promise = new Promise<WorkerData<Output>>((_resolve, _reject) => {
      resolve = _resolve
      reject = _reject
    })

    let unsubscribe: Unsubscribe | null = null
    let completed = false

    function cleanUp() {
      unsubscribe?.()
      client.close().catch(EMPTY_FUNC)
    }

    function onResolve(data: WorkerData<Output>): void {
      if (completed) {
        return
      }
      completed = true
      cleanUp()
      resolve(data)
    }

    function onReject(reason?: any): void {
      if (completed) {
        return
      }
      completed = true
      cleanUp()
      reject(reason)
    }

    async function onData(
      data: WorkerData<WorkerFunctionResponse<Output, CallbackData>>,
    ): Promise<void> {
      switch (data.data.type) {
        case WorkerFunctionResponseType.output:
          onResolve({
            data: data.data.data,
            transferList: data.transferList,
          })
          break
        case WorkerFunctionResponseType.callback:
          if (callback) {
            try {
              await callback({
                data: data.data.data,
                transferList: data.transferList,
              })
            } catch (error) {
              onReject(error)
            }
          }
          break
        default:
          onReject(
            new WorkerError(
              WorkerErrorType.messageError,
              `[WorkerFunction] unexpected response: ${JSON.stringify(data)}`,
            ),
          )
          break
      }
    }

    function onError(error: any): void {
      onReject(error)
    }

    function onStatus(status: WorkerClientStatus): void {
      if (status === WorkerClientStatus.closed) {
        onReject(
          new WorkerError(
            WorkerErrorType.closed,
            '[WorkerFunction] worker closed',
          ),
        )
      }
    }

    unsubscribe = client.subscribe(event => {
      switch (event.type) {
        case WorkerClientResponseType.data:
          onData(event.data)
          break
        case WorkerClientResponseType.error:
          onError(event.error)
          break
        case WorkerClientResponseType.status:
          if (event.status === WorkerClientStatus.closed) {
            onStatus(event.status)
          }
          break
        default:
          onReject(
            new WorkerError(
              WorkerErrorType.messageError,
              `[WorkerFunction] unexpected event: ${JSON.stringify(event)}`,
            ),
          )
          break
      }
    })

    onStatus(client.status)

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

    return promise
  }
}
