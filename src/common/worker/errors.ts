/** Emitted when a MessagePort is closed. */
export class CloseError extends Error {
  constructor() {
    super('MessagePort closed')
  }
}

/**
 * Emitted when a Node.js worker thread exits.
 * code 0 means normal exit, non-zero means abnormal termination.
 * In Node.js, an uncaught exception in a worker terminates the worker
 * (unlike the main thread where the process can continue).
 * Browser Web Workers have no exit event - they keep running after unhandled errors.
 * docs: https://nodejs.org/api/worker_threads.html#event-exit
 */
export class ExitError extends Error {
  code: number

  constructor(code: number) {
    super(`Worker exited with code ${code}`)
    this.code = code
  }
}
