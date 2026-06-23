import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import LandingPage from './page'

vi.mock('@/components/landing/Features', () => ({
  Features: () => <section>Features section</section>,
}))

vi.mock('@/components/landing/Footer', () => ({
  Footer: () => <footer>Footer section</footer>,
}))

describe('LandingPage', () => {
  it('renders without crashing', () => {
    render(<LandingPage />)
    expect(screen.getByText('Features section')).toBeInTheDocument()
  })

  it('renders the footer', () => {
    render(<LandingPage />)
    expect(screen.getByText('Footer section')).toBeInTheDocument()
  })
})
