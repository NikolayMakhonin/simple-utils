import type { Unsubscribe } from 'src/common/types/common'
import type { IWorkerEventBus, WorkerEvent } from './types'
import { getNextId } from './getNextId'
import { routePop, routePush } from './route'

export type EventBusConnectArgs<RequestData = any, ResponseData = any> = {
  server: IWorkerEventBus<RequestData, ResponseData>
  client: IWorkerEventBus<ResponseData, RequestData>
  filter?: null | ((event: WorkerEvent<RequestData>) => boolean)
}

/**
 * Bidirectional bridge between two event buses with route-based routing.
 * Client-to-server: filters requests via filter, appends connectionId to route.
 * Server-to-client: checks if response is traveling back through this connection
 * by matching connectionId in route, forwards if matched.
 */
export function eventBusConnect<RequestData = any, ResponseData = any>({
  server,
  client,
  filter,
}: EventBusConnectArgs<RequestData, ResponseData>): Unsubscribe {
  const connectionId = getNextId()

  let unsubscribeServer: Unsubscribe | undefined
  let unsubscribeClient: Unsubscribe | undefined

  function unsubscribe() {
    unsubscribeServer?.()
    unsubscribeClient?.()
  }

  try {
    unsubscribeServer = server.subscribe(event => {
      if (event.route == null) {
        return
      }
      const route = routePop(event.route, connectionId)
      if (route == null) {
        return
      }
      // Isolate this connection's emit failure from other listeners
      // on the same server event bus
      try {
        client.emit({ ...event, route })
      } catch (err) {
        console.error(err)
      }
    })

    unsubscribeClient = client.subscribe(event => {
      if (event.route == null) {
        return
      }
      if (filter != null && !filter(event)) {
        return
      }
      server.emit({ ...event, route: routePush(event.route, connectionId) })
    })
  } catch (err) {
    unsubscribe()
    throw err
  }

  return unsubscribe
}
