import type { PairingNode } from '@flemist/pairing-heap'

export function pairingHeapForEach<Item>(
  root: PairingNode<Item> | null | undefined,
  /** @returns true to break the loop */
  func: (node: PairingNode<Item>) => boolean | undefined | null | void,
): void {
  if (root == null) {
    return
  }
  const stack: PairingNode<Item>[] = [root]
  while (stack.length > 0) {
    const node = stack.pop()!
    const result = func(node)
    if (result) {
      break
    }
    let childNode = node.child
    while (childNode != null) {
      stack.push(childNode)
      childNode = childNode.next
    }
  }
}
