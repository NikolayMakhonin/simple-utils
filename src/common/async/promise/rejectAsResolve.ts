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
 * Like reject(reason) of a promise executor, but resolves the promise with a thenable that rejects,
 * to prevent the GC hang of Node.js on mass rejections;
 * fixed in Node.js >=20.15.0, browsers are not affected
 */
export function rejectAsResolve(resolve: (value: any) => void, reason?: any) {
  resolve(_promiseRejected(reason))
}

// see: https://stackoverflow.com/questions/72727907/promise-reject-is-very-slow-on-node-js-18
// see: https://github.com/nodejs/node/issues/43655
/**
 * Like Promise.reject(reason), but resolves the promise with a thenable that rejects,
 * to prevent the GC hang of Node.js on mass rejections;
 * fixed in Node.js >=20.15.0, browsers are not affected
 */
export function promiseRejected(reason?: any): Promise<never> {
  return Promise.resolve(_promiseRejected(reason))
}
