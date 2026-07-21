import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Circle } from './Circle'

describe('Circle', () => {
    it('renders children', () => {
        render(<Circle x={100} y={100}>Icon</Circle>)
        expect(screen.getByText('Icon')).toBeInTheDocument()
    })

    it('applies default classes for shape and styling', () => {
        render(<Circle x={100} y={100}>Content</Circle>)
        const wrapper = screen.getByText('Content')
        expect(wrapper).toHaveClass('absolute', 'w-14', 'h-14', 'rounded-full', 'bg-neutral-900')
    })

    it('merges custom className alongside default classes', () => {
        render(<Circle x={100} y={100} className="custom-class">Content</Circle>)
        const wrapper = screen.getByText('Content')
        expect(wrapper).toHaveClass('custom-class')
        expect(wrapper).toHaveClass('absolute')
    })

    it('positions itself based on x and y props', () => {
        render(<Circle x={100} y={80}>Content</Circle>)
        const wrapper = screen.getByText('Content')
        expect(wrapper).toHaveStyle({ left: '68px', top: '48px' })
    })

    it('renders without children', () => {
        const { container } = render(<Circle x={0} y={0} />)
        expect(container.querySelector('div')).toBeInTheDocument()
    })
})