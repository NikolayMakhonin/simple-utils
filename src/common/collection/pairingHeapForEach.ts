import type { PairingNode } from '@flemist/pairing-heap'

export function pairingHeapForEach<Item>(
  node: PairingNode<Item> | null | undefined,
  /** @returns true to break the loop */
  func: (node: PairingNode<Item>) => boolean | undefined | null | void,
): void {
  if (node == null) {
    return
  }
  const stack: PairingNode<Item>[] = [node]
  while (stack.length > 0) {
    const node = stack.pop() as PairingNode<Item>
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
