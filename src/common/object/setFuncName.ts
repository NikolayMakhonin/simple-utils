import { FuncAny } from '@flemist/async-utils'

export function setFuncName<T extends FuncAny>(func: T, name: string): T {
  Object.defineProperty(func, 'name', { value: name, configurable: true })
  return func
}
