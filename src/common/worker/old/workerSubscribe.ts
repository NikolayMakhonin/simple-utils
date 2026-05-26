import type { Unsubscribe } from 'src/common/types/common'
import type { IWorkerEventObservable, WorkerEvent } from './types'
import { routePop } from './route'
import type { Listener } from '../rx'

export type WorkerSubscribeOptions = {
  /** When provided, only events whose route ends with this requestId will be delivered. */
  requestId?: null | string
}

/**
 * Subscribes to events on the event bus.
 * When requestId is provided, filters events by requestId
 */
export function workerSubscribe<ResponseData = any>(
  eventBus: IWorkerEventObservable<ResponseData>,
  listener: Listener<WorkerEvent<ResponseData>>,
  options?: null | WorkerSubscribeOptions,
): Unsubscribe {
  const requestId = options?.requestId
  if (requestId == null) {
    return eventBus.subscribe(listener)
  }

  return eventBus.subscribe(event => {
    if (event.route == null) {
      return
    }
    const route = routePop(event.route, requestId)
    if (route == null) {
      return
    }
    if (route.length > 0) {
      listener({
        hasError: true,
        error: new Error(
          `[workerSubscribe] unexpected remaining route length: ${route.length}`,
        ),
      })
      return
    }
    listener(event)
  })
}
