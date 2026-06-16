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
 * see: https://github.com/nodejs/node/issues/43655
 * resolve(Promise.reject()) instead of reject() to work around Node.js GC hang on mass rejections;
 * fixed in Node.js >=20.15.0, browsers are not affected
 */
export function rejectAsResolve(resolve: (value: any) => void, reason?: any) {
  resolve(_promiseRejected(reason))
}

/**
 * It needed to prevent memory leak on some platforms
 * see: https://stackoverflow.com/questions/72727907/promise-reject-is-very-slow-on-node-js-18
 * see: https://github.com/nodejs/node/issues/43655
 * resolve(Promise.reject()) instead of reject() to work around Node.js GC hang on mass rejections;
 * fixed in Node.js >=20.15.0, browsers are not affected
 */
export function promiseRejected(reason?: any): Promise<never> {
  return Promise.resolve(_promiseRejected(reason))
}
