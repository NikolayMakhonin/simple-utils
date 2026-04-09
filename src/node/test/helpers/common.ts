import { ElementHandle } from 'playwright'

export async function clickAll(parent: ElementHandle, selector: string) {
  const elements = await parent.$$(selector)
  // параллельность не работает, он кликает только последний элемент
  // await Promise.all(elements.map(element => element.click()))
  for (const element of elements) {
    await element.click()
  }
}
