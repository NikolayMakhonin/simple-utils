import type { ISubject } from 'src/common/rx'
import { type WorkerData } from '../types'
import { serializeError } from '../helpers'
import type {
  WorkerEvent,
  WorkerEventRequest,
  WorkerEventResponse,
  WorkerEventResponseError,
} from './types'
import type { Unsubscribe, PromiseOrValue } from 'src/common/types'

export function workerRequestHandler<RequestData, ResponseData>(
  eventBus: ISubject<WorkerEvent<any>, WorkerEvent<any>>,
  handler: (
    data: WorkerData<RequestData>,
  ) => PromiseOrValue<WorkerData<ResponseData>>,
): Unsubscribe {
  async function respond(
    request: WorkerEventRequest<RequestData>,
  ): Promise<void> {
    let response: WorkerEventResponse<ResponseData> | WorkerEventResponseError
    try {
      const result = await handler(request.data)
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
    try {
      eventBus.emit(response)
    } catch (error) {
      // Ignore error if connection is closed
    }
  }

  return eventBus.subscribe(event => {
    if (event.type !== 'request') {
      return
    }
    void respond(event as WorkerEventRequest<RequestData>)
  })
}
