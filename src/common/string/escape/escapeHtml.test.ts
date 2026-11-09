import { describe, it, expect } from 'vitest'
import { escapeHtml } from './escapeHtml'

describe('escapeHtml', () => {
  it('null and undefined return null', () => {
    const nullable: string | null = null as string | null
    expect(escapeHtml(nullable)).toBe(null)
    expect(escapeHtml(undefined)).toBe(null)
  })
})
