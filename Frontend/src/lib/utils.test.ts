import { describe, it, expect } from 'vitest'
import { cn } from './utils'

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('returns empty string for no valid inputs', () => {
    expect(cn(undefined, false, null as never)).toBe('')
  })

  it('handles falsy values without including them', () => {
    expect(cn('foo', undefined, false, 'bar')).toBe('foo bar')
  })

  it('deduplicates conflicting tailwind classes — last one wins', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4')
  })

  it('handles conditional objects — includes truthy keys, excludes falsy', () => {
    expect(cn({ 'text-red-500': true, 'text-blue-500': false })).toBe('text-red-500')
  })

  it('handles arrays of class names', () => {
    expect(cn(['foo', 'bar'])).toBe('foo bar')
  })

  it('merges tailwind conflicting utilities across multiple args', () => {
    expect(cn('px-4 py-2', 'px-6')).toBe('py-2 px-6')
  })
})
