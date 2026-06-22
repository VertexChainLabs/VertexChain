import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import MapPage from './page'

vi.mock('@/components/map/MapLoader', () => ({
  default: () => <div data-testid="map-loader">Map Loaded</div>,
}))

describe('Map Page', () => {
  it('renders without crashing', () => {
    render(<MapPage />)
    expect(screen.getByTestId('map-loader')).toBeInTheDocument()
  })

  it('renders inside a full-screen container', () => {
    const { container } = render(<MapPage />)
    const main = container.querySelector('main')
    expect(main).toHaveClass('h-screen', 'w-screen')
  })
})
