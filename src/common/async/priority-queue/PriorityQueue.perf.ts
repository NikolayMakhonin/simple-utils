import { describe, it } from 'vitest'
import { PriorityQueue } from './PriorityQueue'

describe('priority-queue > PriorityQueue', function () {
  it('1 million', { timeout: 60 * 60 * 1000 }, async () => {
    const queue = new PriorityQueue()

    const promises = Array.from({ length: 3000000 }, (_, i) => {
      // return queue.run(() => {
      // return null
      // return new Promise(resolve => setTimeout(resolve, 0))
      let resolve
      const promise = new Promise(_resolve => {
        resolve = _resolve
      })
      resolve(null)
      return promise
      // })
    })

    await Promise.allSettled(promises)

    console.log('COMPLETED')
  })
})
