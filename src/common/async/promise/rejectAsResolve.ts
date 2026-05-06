function _promiseRejected(reason?: any): PromiseLike<never> {
  return {
    then(_, reject): any {
      void reject!(reason)
    },
  }
}

/**
 * It needed to prevent memory leak on some platforms
 * see: https://stackoverflow.com/questions/72727907/promise-reject-is-very-slow-on-node-js-18
 *  */
export function rejectAsResolve(resolve: (value: any) => void, reason?: any) {
  resolve(_promiseRejected(reason))
}

/**
 * It needed to prevent memory leak on some platforms
 * see: https://stackoverflow.com/questions/72727907/promise-reject-is-very-slow-on-node-js-18
 * */
export function promiseRejected(reason?: any): Promise<never> {
  return Promise.resolve(_promiseRejected(reason))
}
