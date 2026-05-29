import type { IAbortSignalFast } from '@flemist/abort-controller-fast'
import type { ISubject } from 'src/common/rx'
import { waitObservable } from 'src/common/rx'
import type {
  WorkerData,
  WorkerEvent,
  WorkerEventRequest,
  WorkerEventResponse,
  WorkerEventResponseError,
} from '../types'
import { deserializeError } from '../helpers'
import { withTimeout } from 'src/common/async/timeout/withTimeout'
import type { ITimeController } from '@flemist/time-controller'

let prevRequestId = 0

export type WorkerRequestOptions = {
  readonly abortSignal?: null | IAbortSignalFast
  readonly timeout?: null | number
  readonly timeController?: null | ITimeController
}

export function workerRequest<RequestData, ResponseData>(
  eventBus: ISubject<WorkerEvent<any>, WorkerEvent<any>>,
  data: WorkerData<RequestData>,
  options?: null | WorkerRequestOptions,
): Promise<WorkerData<ResponseData>> {
  const requestId = ++prevRequestId

  return withTimeout(
    abortSignal => {
      const promise = waitObservable(
        eventBus,
        event =>
          (event.type === 'response' || event.type === 'responseError') &&
          event.requestId === requestId,
        abortSignal,
      ).then(event => {
        if (event.type === 'responseError') {
          throw deserializeError((event as WorkerEventResponseError).error)
        }
        return (event as WorkerEventResponse<ResponseData>).data
      })

      eventBus.emit({
        type: 'request',
        requestId,
        data,
      } as WorkerEventRequest<RequestData>)

      return promise
    },
    {
      abortSignal: options?.abortSignal,
      timeout: options?.timeout,
      timeController: options?.timeController,
    },
  )
}
