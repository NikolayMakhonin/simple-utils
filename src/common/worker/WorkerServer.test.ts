import { describe, expect, it } from 'vitest'
import { WorkerServer } from './WorkerServer'
import { WorkerServerResponseType } from './types'

describe('WorkerServer', () => {
  it('close before connect sends the close message', async () => {
    const { port1, port2 } = new MessageChannel()
    const message = new Promise(resolve => {
      port2.addEventListener('message', event => {
        resolve(event.data)
      })
      port2.start()
    })
    new WorkerServer<unknown, unknown>({ messagePort: port1 }).close()
    expect(await message).toEqual({ type: WorkerServerResponseType.close })
  })
})
