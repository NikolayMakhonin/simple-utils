import { describe, it } from 'vitest'
import { formatAny } from 'src/common'

class CustomError extends Error {
  prop1: string
  prop2: number
  constructor(
    message: string,
    prop1: string,
    prop2: number,
    options?: null | ErrorOptions,
  ) {
    super(message, options ?? undefined)
    this.prop1 = prop1
    this.prop2 = prop2
  }
}

describe('formatAny', () => {
  it('base', () => {
    console.log(
      formatAny({ err: new CustomError('TEST', 'a', 2) }, { pretty: true }),
    )
  })
})
