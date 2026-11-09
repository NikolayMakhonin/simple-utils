import { describe, it, expect } from 'vitest'
import { escapeHtml } from './escapeHtml'

describe('escapeHtml', () => {
  function test(text: string) {
    const element = document.createElement('div')
    element.innerHTML = escapeHtml(text)
    expect(element.children.length).toBe(0)
    expect(element.textContent).toBe(text)
  }

  it('result inserted as HTML shows the text as is and creates no elements', () => {
    test('<img src=x onerror="alert(1)">')
    test('<script>alert(1)</script>')
    test('&lt;b&gt;&amp;')
    test(`"'<>&`)
  })

  it('result inserted into a quoted attribute gives the text as is and adds no attributes', () => {
    const text = `" onerror="alert(1)' onerror='alert(1)`
    const element = document.createElement('div')
    element.innerHTML = `<a title="${escapeHtml(text)}"></a><a title='${escapeHtml(text)}'></a>`
    expect(element.children.length).toBe(2)
    for (let i = 0; i < 2; i++) {
      const child = element.children[i]
      expect(child.getAttributeNames()).toEqual(['title'])
      expect(child.getAttribute('title')).toBe(text)
    }
  })
})
