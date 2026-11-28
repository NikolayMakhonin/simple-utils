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
  readonly #exitWrappers = new Map<
    (error: Error) => void,
    (exitCode: number) => void
  >()
  readonly #worker: NodeWorker
  #isTerminated = false

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
    if (event === 'error' && !this.#exitWrappers.has(listener)) {
      const wrapper = (exitCode: number) => {
        // No error after terminate(): terminate() exits the worker with code 1,
        // the same code as a crash. The code below would report it as fatalError
        if (this.#isTerminated) {
          return
        }
        listener(
          new WorkerError(
            exitCode === 0
              ? WorkerErrorType.closed
              : WorkerErrorType.fatalError,
            `[WorkerNode] worker exited with code ${exitCode}`,
          ),
        )
      }
      this.#worker.on('exit', wrapper)
      this.#exitWrappers.set(listener, wrapper)
    }
    this.#worker.on(event, listener)
    return this
  }

  off(event: 'error', listener: (err: Error) => void): this
  off(event: 'message', listener: (value: any) => void): this
  off(event: 'messageerror', listener: (error: Error) => void): this
  off(event: 'error' | 'message' | 'messageerror', listener: any): this {
    if (event === 'error') {
      const wrapper = this.#exitWrappers.get(listener)
      if (wrapper != null) {
        this.#worker.off('exit', wrapper)
        this.#exitWrappers.delete(listener)
      }
    }
    this.#worker.off(event, listener)
    return this
  }

  async terminate(): Promise<void> {
    this.#isTerminated = true
    await this.#worker.terminate()
  }
}
