/**
 * Same as Promise.all but waits for all promises to settle
 * and throws if any promise is rejected.
 */
export async function promiseAllWait<T extends readonly unknown[] | []>(
  promises: T,
): Promise<{ -readonly [P in keyof T]: Awaited<T[P]> }> {
  const states = await Promise.allSettled(promises)
  const results: any[] = []
  states.forEach(state => {
    if (state.status === 'fulfilled') {
      results.push(state.value)
    } else {
      throw state.reason
    }
  })
  return results as any
}
