import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Badge } from './badge'

describe('Badge', () => {
  it('renders children', () => {
    render(<Badge>Label</Badge>)
    expect(screen.getByText('Label')).toBeInTheDocument()
  })

  it('has data-slot="badge" attribute', () => {
    render(<Badge>Test</Badge>)
    expect(screen.getByText('Test')).toHaveAttribute('data-slot', 'badge')
  })

  it('default variant applies primary background and foreground classes', () => {
    render(<Badge>Default</Badge>)
    const badge = screen.getByText('Default')
    expect(badge).toHaveClass('bg-primary', 'text-primary-foreground', 'border-transparent')
  })

  it('secondary variant applies secondary background and foreground classes', () => {
    render(<Badge variant="secondary">Secondary</Badge>)
    const badge = screen.getByText('Secondary')
    expect(badge).toHaveClass('bg-secondary', 'text-secondary-foreground', 'border-transparent')
  })

  it('destructive variant applies destructive background and white text', () => {
    render(<Badge variant="destructive">Destructive</Badge>)
    const badge = screen.getByText('Destructive')
    expect(badge).toHaveClass('bg-destructive', 'text-white', 'border-transparent')
  })

  it('outline variant applies foreground text color', () => {
    render(<Badge variant="outline">Outline</Badge>)
    const badge = screen.getByText('Outline')
    expect(badge).toHaveClass('text-foreground')
    expect(badge).not.toHaveClass('border-transparent')
  })

  it('merges custom className alongside variant classes', () => {
    render(<Badge className="custom-class">Custom</Badge>)
    const badge = screen.getByText('Custom')
    expect(badge).toHaveClass('custom-class')
    expect(badge).toHaveClass('bg-primary')
  })
})
