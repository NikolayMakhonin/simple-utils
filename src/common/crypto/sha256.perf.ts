import { describe, it } from 'vitest'
import crypto from 'node:crypto'
import { calcPerformance } from 'rdtsc/node'
import { sha256 } from './sha256'
import { sha256Node } from './sha256Node'

describe('calcSha256', () => {
  it('perf', () => {
    const len = 10
    let bytes = crypto.randomBytes(len)
    const result = calcPerformance({
      time: 10000,
      funcs: [
        () => {},
        () => {
          return sha256Node(bytes)
        },
        () => {
          return sha256(bytes)
        },
        () => {
          bytes = crypto.randomBytes(len)
        },
      ],
    })

    console.log(result)
  })
})
