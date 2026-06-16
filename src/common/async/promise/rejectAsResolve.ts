function _promiseRejected(reason?: any): PromiseLike<never> {
  return {
    then(_, reject): any {
      void reject!(reason)
    },
  }
}

// see: https://stackoverflow.com/questions/72727907/promise-reject-is-very-slow-on-node-js-18
// see: https://github.com/nodejs/node/issues/43655
/**
 * Rejects a promise via resolve(Promise.reject()) to prevent GC hang on mass rejections;
 * fixed in Node.js >=20.15.0, browsers are not affected
 */
export function rejectAsResolve(resolve: (value: any) => void, reason?: any) {
  resolve(_promiseRejected(reason))
}

// see: https://stackoverflow.com/questions/72727907/promise-reject-is-very-slow-on-node-js-18
// see: https://github.com/nodejs/node/issues/43655
/**
 * Creates a rejected promise via Promise.resolve(Promise.reject()) to prevent GC hang on mass rejections;
 * fixed in Node.js >=20.15.0, browsers are not affected
 */
export function promiseRejected(reason?: any): Promise<never> {
  return Promise.resolve(_promiseRejected(reason))
}
