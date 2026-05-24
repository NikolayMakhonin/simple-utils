import { messagePortToEventBus } from './messagePortToEventBus'
import { eventBusConnect, type EventBusConnectArgs } from './eventBusConnect'
import type { IMessagePort } from './types'

export type EventBusToMessagePortArgs<
  RequestData = any,
  ResponseData = any,
> = Pick<EventBusConnectArgs<RequestData, ResponseData>, 'server' | 'filter'>

/**
 * Creates a MessagePort connected to a server event bus.
 * The returned port can be passed to a worker, enabling the worker
 * to call functions on the server without knowing the topology behind it.
 */
export function eventBusToMessagePort<RequestData = any, ResponseData = any>({
  server,
  filter,
}: EventBusToMessagePortArgs<RequestData, ResponseData>): IMessagePort {
  const channel = new MessageChannel()
  const client = messagePortToEventBus(channel.port1 as IMessagePort)
  eventBusConnect({
    server,
    client,
    filter,
  })
  return channel.port2 as IMessagePort
}
