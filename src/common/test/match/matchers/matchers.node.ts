import { describe, it, expect } from 'vitest'
import * as vm from 'node:vm'
import { match } from '../match'
import { matchAny, matchArray, matchArrayItem } from './matchers'

describe('matchArray and matchArrayItem', () => {
  it('an array of another realm', () => {
    const array = vm.runInNewContext('[1, 2]')
    expect(array instanceof Array).toBe(false)
    expect(match(array, matchArray([1, 2])).result).toBe(true)
    expect(match(array, matchArrayItem(2, matchAny())).result).toBe(true)
  })
})
