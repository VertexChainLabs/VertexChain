import { render } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { AnimatedBeam } from './animated-beam'

vi.mock('framer-motion', () => ({
    motion: {
        path: (props: React.SVGProps<SVGPathElement>) => <path {...props} />,
    },
    useAnimation: () => ({ start: vi.fn() }),
}))

describe('AnimatedBeam', () => {
    it('renders an svg wrapper', () => {
        const { container } = render(
            <AnimatedBeam startX={0} startY={0} endX={100} endY={100} px={0} py={0} />
        )
        expect(container.querySelector('svg')).toBeInTheDocument()
    })

    it('renders a gradient definition used by the beam stroke', () => {
        const { container } = render(
            <AnimatedBeam startX={0} startY={0} endX={100} endY={100} px={0} py={0} />
        )
        const gradient = container.querySelector('linearGradient#gradient')
        expect(gradient).toBeInTheDocument()
    })

    it('builds a path using the provided coordinates', () => {
        const { container } = render(
            <AnimatedBeam startX={10} startY={10} endX={110} endY={10} px={5} py={5} />
        )
        const path = container.querySelector('path')
        expect(path).toHaveAttribute('d', 'M15,15 Q60,-40 110,10')
    })

    it('references the gradient in the path stroke', () => {
        const { container } = render(
            <AnimatedBeam startX={0} startY={0} endX={50} endY={50} px={0} py={0} />
        )
        const path = container.querySelector('path')
        expect(path).toHaveAttribute('stroke', 'url(#gradient)')
    })
})