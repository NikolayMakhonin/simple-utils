import {
  type IWorkerEventBus,
  type WorkerData,
  type WorkerEvent,
  type WorkerEventRequest,
  type WorkerEventResponse,
  type WorkerEventResponseError,
} from '../types'
import { serializeError } from '../helpers'
import type { Unsubscribe, PromiseLikeOrValue } from 'src/common/types'
import type { IAbortSignalFast } from '@flemist/abort-controller-fast'

export function workerRequestHandler<RequestData, ResponseData>(
  eventBus: IWorkerEventBus<WorkerEvent<any>, WorkerEvent<any>>,
  handler: (
    data: WorkerData<RequestData>,
    abortSignal: IAbortSignalFast,
  ) => PromiseLikeOrValue<WorkerData<ResponseData>>,
): Unsubscribe {
  async function respond(
    request: WorkerEventRequest<RequestData>,
  ): Promise<void> {
    let response: WorkerEventResponse<ResponseData> | WorkerEventResponseError
    try {
      const result = await handler(request.data, eventBus.abortSignal)
      response = {
        type: 'response',
        requestId: request.requestId,
        data: result,
      } as WorkerEventResponse<ResponseData>
    } catch (error) {
      response = {
        type: 'responseError',
        requestId: request.requestId,
        error: serializeError(error),
      } as WorkerEventResponseError
    }
    if (eventBus.abortSignal.aborted) {
      return
    }
    eventBus.emit(response)
  }

  return eventBus.subscribe(event => {
    if (event.type !== 'request') {
      return
    }
    void respond(event as WorkerEventRequest<RequestData>)
  })
}
