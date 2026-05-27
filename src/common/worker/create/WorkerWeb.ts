import {
  type IWorker,
  type TransferableAny,
  WorkerError,
  WorkerErrorType,
} from '../types'
import { errorEventToWorkerError } from '../helpers'

export class WorkerWeb implements IWorker {
  readonly #listenerWrappers: Map<string, Map<any, any>> = new Map()
  readonly #worker: Worker

  constructor(worker: Worker) {
    this.#worker = worker
  }

  postMessage(message: any, transfer: TransferableAny[]): void {
    this.#worker.postMessage(message, transfer)
  }

  on(event: 'error', listener: (err: Error) => void): this
  on(event: 'message', listener: (value: any) => void): this
  on(event: 'messageerror', listener: (error: Error) => void): this
  on(event: 'error' | 'message' | 'messageerror', listener: any): this {
    let listenerWrappers = this.#listenerWrappers.get(event)
    if (listenerWrappers == null) {
      listenerWrappers = new Map()
      this.#listenerWrappers.set(event, listenerWrappers)
    }
    let wrapper = listenerWrappers.get(listener)
    if (wrapper != null) {
      return this
    }
    switch (event) {
      case 'error':
        wrapper = (event: ErrorEvent) => {
          listener(errorEventToWorkerError(event))
        }
        break
      case 'message':
        wrapper = (event: MessageEvent) => {
          listener(event.data)
        }
        break
      case 'messageerror':
        wrapper = () => {
          listener(
            new WorkerError(
              WorkerErrorType.messageError,
              `[WorkerWeb] message error`,
            ),
          )
        }
        break
      default:
        throw new Error(`[WorkerWeb] Unsupported event type: ${event}`)
    }
    this.#worker.addEventListener(event, wrapper)
    listenerWrappers.set(listener, wrapper)
    return this
  }

  off(event: 'error', listener: (err: Error) => void): this
  off(event: 'message', listener: (value: any) => void): this
  off(event: 'messageerror', listener: (error: Error) => void): this
  off(event: 'error' | 'message' | 'messageerror', listener: any): this {
    const listenerWrappers = this.#listenerWrappers.get(event)
    if (listenerWrappers != null) {
      const wrapper = listenerWrappers.get(listener)
      if (wrapper != null) {
        this.#worker.removeEventListener(event, wrapper)
        listenerWrappers.delete(listener)
      }
    }
    return this
  }

  terminate(): void {
    this.#worker.terminate()
  }
}
