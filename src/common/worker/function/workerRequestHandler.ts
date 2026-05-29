import type { ISubject } from 'src/common/rx'
import type { WorkerData } from '../types'
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
    try {
      const result = await handler(request.data)
      eventBus.emit({
        type: 'response',
        requestId: request.requestId,
        data: result,
      } as WorkerEventResponse<ResponseData>)
    } catch (error) {
      eventBus.emit({
        type: 'responseError',
        requestId: request.requestId,
        error: serializeError(error),
      } as WorkerEventResponseError)
    }
  }

  return eventBus.subscribe(event => {
    if (event.type !== 'request') {
      return
    }
    void respond(event as WorkerEventRequest<RequestData>)
  })
}
