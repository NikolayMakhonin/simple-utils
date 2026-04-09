import type { CDPSession, Page } from 'playwright'

export async function createCDPSession(page: Page): Promise<CDPSession> {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('DOM.enable')
  await cdp.send('CSS.enable')
  return cdp
}

export async function destroyCDPSession(cdp: CDPSession): Promise<void> {
  await cdp.send('CSS.disable')
  await cdp.send('DOM.disable')
  await cdp.detach()
}

export async function usingCDPSession<Result>(
  page: Page,
  func: (cdp: CDPSession) => Promise<Result>,
): Promise<Result> {
  const cdp = await createCDPSession(page)
  try {
    return await func(cdp)
  } finally {
    await destroyCDPSession(cdp)
  }
}

export async function forcePseudoClasses(
  cdp: CDPSession,
  pseudoClasses: string[],
): Promise<void> {
  const { nodes } = await cdp.send('DOM.getFlattenedDocument', {
    depth: -1,
    pierce: true,
  })

  const elementNodeIds = nodes
    .filter(n => n.nodeType === 1) // ELEMENT_NODE
    .map(n => n.nodeId)

  for (const nodeId of elementNodeIds) {
    await cdp.send('CSS.forcePseudoState', {
      nodeId,
      forcedPseudoClasses: pseudoClasses,
    })
  }
}
