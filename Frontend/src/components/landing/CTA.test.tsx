import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import CTA from './CTA'

vi.mock('next/link', () => ({
    default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
        <a href={href} {...props}>{children}</a>
    ),
}))

vi.mock('gsap', () => ({
    default: { fromTo: vi.fn(), registerPlugin: vi.fn(), from: vi.fn() },
}))

vi.mock('gsap/ScrollTrigger', () => ({
    ScrollTrigger: {},
}))

vi.mock('@gsap/react', () => ({
    useGSAP: vi.fn((fn: () => void) => fn()),
}))

vi.mock('@/components/ui/grid-pattern', () => ({
    GridPattern: () => <div data-testid="grid-pattern" />,
}))

describe('CTA', () => {
    it('renders the heading', () => {
        render(<CTA />)
        expect(screen.getByText(/Ready to See What/)).toBeInTheDocument()
        expect(screen.getByText('Happening')).toBeInTheDocument()
    })

    it('renders the descriptive paragraph', () => {
        render(<CTA />)
        expect(
            screen.getByText(/discover and share what's happening right now/)
        ).toBeInTheDocument()
    })

    it('renders a link to the live map', () => {
        render(<CTA />)
        const link = screen.getByRole('link', { name: /Explore the Live Map/ })
        expect(link).toHaveAttribute('href', '/map')
    })

    it('renders the background grid pattern', () => {
        render(<CTA />)
        expect(screen.getByTestId('grid-pattern')).toBeInTheDocument()
    })

    it('does not trigger GSAP animations when prefers-reduced-motion is enabled', () => {
        const originalMatchMedia = window.matchMedia
        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            configurable: true,
            value: vi.fn().mockImplementation((query) => ({
                matches: query === '(prefers-reduced-motion: reduce)',
                media: query,
                onchange: null,
                addListener: vi.fn(),
                removeListener: vi.fn(),
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
                dispatchEvent: vi.fn(),
            })),
        })

        render(<CTA />)
        expect(screen.getByText('Happening')).toBeInTheDocument()

        if (originalMatchMedia) {
            Object.defineProperty(window, 'matchMedia', {
                writable: true,
                configurable: true,
                value: originalMatchMedia,
            })
        } else {
            delete (window as { matchMedia?: unknown }).matchMedia
        }
    })
})