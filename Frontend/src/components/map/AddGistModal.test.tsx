import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import AddGistModal from './AddGistModal'

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode }) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

const onClose = vi.fn()
const onAddGist = vi.fn()

const renderModal = (isOpen = true) =>
  render(<AddGistModal isOpen={isOpen} onClose={onClose} onAddGist={onAddGist} />)

describe('AddGistModal', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    onClose.mockClear()
    onAddGist.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not render the dialog when isOpen is false', () => {
    renderModal(false)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders the dialog when isOpen is true', () => {
    renderModal()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Pin a New Gist')).toBeInTheDocument()
  })

  it('textarea enforces the 280 character limit via maxLength attribute', () => {
    renderModal()
    const textarea = screen.getByRole('textbox', { name: /gist content/i })
    expect(textarea).toHaveAttribute('maxLength', '280')
  })

  it('calls onClose when the backdrop is clicked', () => {
    renderModal()
    const backdrop = screen.getByRole('dialog').parentElement!
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not call onAddGist when submitted with empty content', () => {
    renderModal()
    fireEvent.click(screen.getByRole('button', { name: /pin gist/i }))
    act(() => { vi.advanceTimersByTime(2000) })
    expect(onAddGist).not.toHaveBeenCalled()
  })

  it('shows loading state while submitting', () => {
    renderModal()
    fireEvent.change(screen.getByRole('textbox', { name: /gist content/i }), {
      target: { value: 'Traffic jam on the bridge!' },
    })
    fireEvent.click(screen.getByRole('button', { name: /pin gist/i }))
    expect(screen.getByRole('button', { name: /pinning/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /pinning/i })).toBeDisabled()
  })

  it('calls onAddGist with the content and then onClose after 2s', () => {
    renderModal()
    fireEvent.change(screen.getByRole('textbox', { name: /gist content/i }), {
      target: { value: 'Amazing suya spot just opened here!' },
    })
    fireEvent.click(screen.getByRole('button', { name: /pin gist/i }))

    act(() => { vi.advanceTimersByTime(2000) })

    expect(onAddGist).toHaveBeenCalledWith('Amazing suya spot just opened here!')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes the modal on Escape key press', () => {
    renderModal()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not close on Escape when modal is closed', () => {
    renderModal(false)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })
})
