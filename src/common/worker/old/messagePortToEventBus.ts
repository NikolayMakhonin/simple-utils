import { Subject } from 'src/common/rx/Subject'
import type {
  IMessagePort,
  IWorkerEventBus,
  WorkerEventIntermediate,
} from './types'
import { CloseError } from './errors'
import { ALL_CONNECTIONS } from './route'

/**
 * Wraps a cross-platform MessagePort into IWorkerEventBus.
 * Uses addEventListener + port.start() for cross-platform compatibility
 * (works identically in Node.js >=15 and browsers).
 */
export function messagePortToEventBus<RequestData = any, ResponseData = any>(
  messagePort: IMessagePort,
): IWorkerEventBus<RequestData, ResponseData> {
  const messageSubject = new Subject<WorkerEventIntermediate<ResponseData>>({
    startStopNotifier(emit) {
      function onMessage(event: MessageEvent) {
        emit(event.data)
      }
      function onMessageError(event: MessageEvent) {
        emit({ hasError: true, error: event.data, route: [ALL_CONNECTIONS] })
      }
      function onClose(_event: Event) {
        emit({
          hasError: true,
          error: new CloseError(),
          route: [ALL_CONNECTIONS],
        })
      }

      messagePort.addEventListener('message', onMessage)
      messagePort.addEventListener('messageerror', onMessageError)
      // Fires only in Node.js; in browsers the listener is registered but never invoked
      messagePort.addEventListener('close', onClose)
      messagePort.start()

      return () => {
        messagePort.removeEventListener('message', onMessage)
        messagePort.removeEventListener('messageerror', onMessageError)
        messagePort.removeEventListener('close', onClose)
      }
    },
  })

  return {
    subscribe(listener) {
      return messageSubject.subscribe(listener)
    },
    emit(event) {
      messagePort.postMessage(event, event.data?.transferList ?? undefined)
    },
  }
}
