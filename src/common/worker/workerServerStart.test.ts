import { describe, expect, it } from 'vitest'
import { workerServerRegister } from './workerServerStart'
import { EMPTY_FUNC } from 'src/common/constants'

describe('workerServerRegister', () => {
  it('a name of a member of Object.prototype registers like any other name', () => {
    workerServerRegister({ toString: EMPTY_FUNC })
    expect(() => workerServerRegister({ toString: EMPTY_FUNC })).toThrow(
      'handler for connectionName toString already exists',
    )
  })
})
