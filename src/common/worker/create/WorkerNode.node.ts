import { describe, expect, it } from 'vitest'
import { Worker } from 'worker_threads'
import { WorkerNode } from './WorkerNode'
import { WorkerError, WorkerErrorType } from '../types'

const CODE_KEEP_ALIVE = `
  require('worker_threads').parentPort.postMessage('started')
  setInterval(() => {}, 1000)
`

describe('WorkerNode', () => {
  function create(code: string) {
    const nodeWorker = new Worker(code, { eval: true })
    const worker = new WorkerNode(nodeWorker)
    const errors: Error[] = []
    function listener(error: Error) {
      errors.push(error)
    }
    worker.on('error', listener)
    const exited = new Promise<void>(resolve => {
      nodeWorker.once('exit', () => {
        resolve()
      })
    })
    const started = new Promise<void>(resolve => {
      nodeWorker.once('message', () => {
        resolve()
      })
    })
    return { worker, errors, listener, exited, started }
  }

  it('terminate emits no error', async () => {
    const { worker, errors, started } = create(CODE_KEEP_ALIVE)
    await started
    await worker.terminate()
    expect(errors).toEqual([])
  })

  it('exit code 0 emits closed', async () => {
    const { errors, exited } = create('process.exit(0)')
    await exited
    expect(errors).toStrictEqual([
      new WorkerError(WorkerErrorType.closed, 'Worker exited with code 0'),
    ])
  })

  it('other exit code emits fatalError', async () => {
    const { errors, exited } = create('process.exit(3)')
    await exited
    expect(errors).toStrictEqual([
      new WorkerError(WorkerErrorType.fatalError, 'Worker exited with code 3'),
    ])
  })

  it('uncaught error emits it and then fatalError', async () => {
    const { errors, exited } = create(`throw new Error('test error')`)
    await exited
    expect(errors.length).toBe(2)
    expect(errors[0].message).toBe('test error')
    expect(errors[1]).toStrictEqual(
      new WorkerError(WorkerErrorType.fatalError, 'Worker exited with code 1'),
    )
  })

  it('off removes the listener', async () => {
    const { worker, errors, listener, exited } = create('process.exit(3)')
    worker.off('error', listener)
    await exited
    expect(errors).toEqual([])
  })
})
