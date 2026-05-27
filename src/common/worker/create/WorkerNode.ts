import type {
  TransferListItem as TransferableNode,
  Worker as NodeWorker,
} from 'worker_threads'
import {
  type IWorker,
  type TransferableAny,
  WorkerError,
  WorkerErrorType,
} from '../types'

export class WorkerNode implements IWorker {
  readonly #listenerWrappers: Map<string, Map<any, any>> = new Map()
  readonly #worker: NodeWorker

  constructor(worker: NodeWorker) {
    this.#worker = worker
  }

  postMessage(message: any, transfer: TransferableAny[]): void {
    this.#worker.postMessage(message, transfer as TransferableNode[])
  }

  on(event: 'error', listener: (err: Error) => void): this
  on(event: 'message', listener: (value: any) => void): this
  on(event: 'messageerror', listener: (error: Error) => void): this
  on(event: 'error' | 'message' | 'messageerror', listener: any): this {
    if (event === 'error') {
      let listenerWrappers = this.#listenerWrappers.get('exit')
      if (listenerWrappers == null) {
        listenerWrappers = new Map()
        this.#listenerWrappers.set('exit', listenerWrappers)
      }
      let wrapper = listenerWrappers.get(listener)
      if (wrapper == null) {
        wrapper = (exitCode: number) => {
          if (exitCode === 0) {
            listener(
              new WorkerError(
                WorkerErrorType.closed,
                `Worker exited with code ${exitCode}`,
              ),
            )
          } else {
            listener(
              new WorkerError(
                WorkerErrorType.fatalError,
                `Worker exited with code ${exitCode}`,
              ),
            )
          }
        }
        this.#worker.on('exit', wrapper)
        listenerWrappers.set(listener, wrapper)
      }
    }
    this.#worker.on(event, listener)
    return this
  }

  off(event: 'error', listener: (err: Error) => void): this
  off(event: 'message', listener: (value: any) => void): this
  off(event: 'messageerror', listener: (error: Error) => void): this
  off(event: 'error' | 'message' | 'messageerror', listener: any): this {
    if (event === 'error') {
      const listenerWrappers = this.#listenerWrappers.get('exit')
      if (listenerWrappers != null) {
        const wrapper = listenerWrappers.get(listener)
        if (wrapper != null) {
          this.#worker.off('exit', wrapper)
          listenerWrappers.delete(listener)
        }
      }
    }
    this.#worker.off(event, listener)
    return this
  }

  terminate(): void {
    void this.#worker.terminate()
  }
}
