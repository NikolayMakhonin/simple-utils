// Worker requests can travel through a chain of intermediaries:
//   main -> transitWorker -> subWorker -> targetWorker
// The response must travel back through the exact same chain to reach
// the original caller. The route array solves this without routing tables.
//
// How it works:
// - A request starts with route = [requestId].
// - Each intermediary connection appends its unique connectionId
//   to the route via routePush: route becomes [requestId, conn1, conn2, ...].
// - When the response comes back, each intermediary calls routePop to check
//   if the last element is its own connectionId. If yes - this response is traveling
//   back through this intermediary, so it strips its ID and forwards the event.
//   If no - this response belongs to a different connection, skip it.
// - After all intermediaries strip their IDs, route = [requestId] again,
//   and the original subscriber matches the requestId to resolve its promise.
//
// Both functions are pure - they return new arrays instead of mutating.
// This prevents shared-state bugs when multiple subscribers process
// the same event object dispatched by Subject.
//
// ALL_CONNECTIONS is a special marker for error/close/exit events.
// When a worker crashes, the error event is created with route: [ALL_CONNECTIONS].
// routePop matches ALL_CONNECTIONS regardless of the subscriber's connectionId,
// so every direct subscriber on that event bus receives the error.
//
// Limitation: ALL_CONNECTIONS is consumed by routePop like any other element.
// After one hop pops it, the route is empty and further hops see no match.
// So errors propagate one level only - from the crashed worker to its
// immediate subscribers. The main thread typically subscribes directly to
// each worker it cares about and handles cleanup at that level.

/**
 * Matches any connectionId in routePop.
 * Used in error/close/exit events to broadcast to all direct subscribers
 * regardless of their connectionId.
 */
export const ALL_CONNECTIONS = 'ALL_CONNECTIONS'

/**
 * Returns a new route with connectionId appended.
 */
export function routePush(route: string[], connectionId: string): string[] {
  return [...route, connectionId]
}

/**
 * If the last element matches connectionId or ALL_CONNECTIONS,
 * returns a new route without it. Otherwise returns null -
 * this event belongs to a different connection.
 */
export function routePop(
  route: string[],
  connectionId: string,
): string[] | null {
  const len = route.length
  if (
    len === 0 ||
    (route[len - 1] !== connectionId && route[len - 1] !== ALL_CONNECTIONS)
  ) {
    return null
  }
  return route.slice(0, len - 1)
}
