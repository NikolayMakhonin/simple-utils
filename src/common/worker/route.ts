// Worker requests can travel through a chain of intermediaries:
//   main -> transitWorker -> subWorker -> targetWorker
// The response must travel back through the exact same chain to reach
// the original caller. The route array solves this without routing tables.
//
// How it works:
// - A request starts with route = [requestId].
// - Each intermediary connection (eventBusConnect) appends its unique connectionId
//   to the route via routePush: route becomes [requestId, conn1, conn2, ...].
// - When the response comes back, each intermediary calls routePop to check
//   if the last element is its own connectionId. If yes - this response is traveling
//   back through this intermediary, so it strips its ID and forwards the event.
//   If no - this response belongs to a different connection, skip it.
// - After all intermediaries strip their IDs, route = [requestId] again,
//   and the original subscriber matches the requestId to resolve its promise.
//
// The route array is mutated in place because each event object
// is consumed by exactly one subscriber at each level (one requestId = one subscriber).
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
 * Appends connectionId to route as a request passes through an intermediary
 */
export function routePush(route: string[], connectionId: string) {
  route.push(connectionId)
}

/**
 * Checks if this response is traveling back through this intermediary:
 * if the last element matches connectionId or ALL_CONNECTIONS, removes it
 * and returns true. Otherwise returns false without mutation -
 * this event belongs to a different connection.
 */
export function routePop(route: string[], connectionId: string) {
  const len = route.length
  if (
    len === 0 ||
    (route[len - 1] !== connectionId && route[len - 1] !== ALL_CONNECTIONS)
  ) {
    return false
  }
  route.length = len - 1
  return true
}
