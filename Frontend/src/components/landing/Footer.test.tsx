import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Footer } from './Footer'

vi.mock('next/link', () => ({
    default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
        <a href={href} {...props}>{children}</a>
    ),
}))

describe('Footer', () => {
    it('renders the copyright text with the current year', () => {
        render(<Footer />)
        const year = new Date().getFullYear().toString()
        expect(screen.getByText(new RegExp(year))).toBeInTheDocument()
    })

    it('renders a link to the Stellar Network', () => {
        render(<Footer />)
        const stellarLink = screen.getByRole('link', { name: 'Stellar Network' })
        expect(stellarLink).toHaveAttribute('href', 'https://stellar.org')
        expect(stellarLink).toHaveAttribute('target', '_blank')
        expect(stellarLink).toHaveAttribute('rel', 'noopener noreferrer')
    })

    it('renders the footer navigation with Privacy, Terms, and Docs links', () => {
        render(<Footer />)
        const nav = screen.getByRole('navigation', { name: 'Footer navigation' })
        expect(nav).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy')
        expect(screen.getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/terms')
        expect(screen.getByRole('link', { name: 'Docs' })).toHaveAttribute('href', '/docs')
    })

    it('renders as a footer landmark element', () => {
        render(<Footer />)
        expect(screen.getByRole('contentinfo')).toBeInTheDocument()
    })
})