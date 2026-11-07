import { describe, it, expect } from 'vitest'
import { escapeHtml } from './escapeHtml'

describe('escapeHtml', () => {
  it('nullable', () => {
    const nullable: string | null = null as string | null
    expect(escapeHtml(nullable)).toBe(null)
    expect(escapeHtml(undefined)).toBe(null)
  })
})
