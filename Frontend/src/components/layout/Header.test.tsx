import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Header } from './Header'

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

vi.mock('next/image', () => ({
  default: ({ alt, ...props }: { src: string; alt: string; width: number; height: number; className?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} {...props} />
  ),
}))

describe('Header', () => {
  it('renders the brand name', () => {
    render(<Header />)
    expect(screen.getByText('VertexChain')).toBeInTheDocument()
  })

  it('renders the logo with correct alt text', () => {
    render(<Header />)
    expect(screen.getByAltText('VertexChain Logo')).toBeInTheDocument()
  })

  it('renders the home link with correct href', () => {
    render(<Header />)
    const homeLink = screen.getByRole('link', { name: /vertexchain logo/i })
    expect(homeLink).toHaveAttribute('href', '/')
  })

  it('renders the Map navigation link with correct href', () => {
    render(<Header />)
    const mapLink = screen.getByRole('link', { name: /^map$/i })
    expect(mapLink).toHaveAttribute('href', '/map')
  })

  it('renders the main navigation landmark', () => {
    render(<Header />)
    expect(screen.getByRole('navigation', { name: /main navigation/i })).toBeInTheDocument()
  })
})
