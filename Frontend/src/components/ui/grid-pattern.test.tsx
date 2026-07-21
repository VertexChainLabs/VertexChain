import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { GridPattern } from './grid-pattern'

describe('GridPattern', () => {
    it('renders an svg with aria-hidden set to true', () => {
        const { container } = render(<GridPattern width={20} height={20} x={0} y={0} />)
        const svg = container.querySelector('svg')
        expect(svg).toBeInTheDocument()
        expect(svg).toHaveAttribute('aria-hidden', 'true')
    })

    it('applies a custom className to the svg element', () => {
        const { container } = render(
            <GridPattern width={20} height={20} x={0} y={0} className="custom-grid" />
        )
        const svg = container.querySelector('svg')
        expect(svg).toHaveClass('custom-grid')
    })

    it('renders a pattern with a path using the given width and height', () => {
        const { container } = render(<GridPattern width={30} height={40} x={-1} y={-1} />)
        const path = container.querySelector('path')
        expect(path).toHaveAttribute('d', 'M 30 0 L 0 0 0 40')
    })

    it('renders one rect per entry in the squares prop', () => {
        const { container } = render(
            <GridPattern width={20} height={20} x={0} y={0} squares={[[0, 0], [1, 2]]} />
        )
        const rects = container.querySelectorAll('rect')
        // 1 background rect + 2 square rects
        expect(rects.length).toBe(3)
    })

    it('renders no extra square rects when squares is not provided', () => {
        const { container } = render(<GridPattern width={20} height={20} x={0} y={0} />)
        const rects = container.querySelectorAll('rect')
        expect(rects.length).toBe(1)
    })
})