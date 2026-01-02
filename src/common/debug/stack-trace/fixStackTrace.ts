import { getStackTrace } from './getStackTrace'

// TODO: write doc comment
export function fixStackTrace<This, Args extends any[], Return>(
  func: (this: This, ...args: Args) => Return,
): (this: This, ...args: Args) => Return {
  return function (this: This, ...args: Args): Return {
    const stack = getStackTrace()
    try {
      return func.apply(this, args)
    } catch (error: any) {
      if (!(error instanceof Error)) {
        // eslint-disable-next-line no-ex-assign
        error = new Error(String(error))
      }
      error.stack = error.stack ? error.stack + '\n' + stack : stack
      throw error
    }
  }
}
