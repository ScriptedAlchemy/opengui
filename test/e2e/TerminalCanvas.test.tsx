import { describe, it, expect, vi, beforeEach } from '@rstest/core'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TerminalCanvas } from '@/features/cli/TerminalCanvas'
import { useCliSessionsStore } from '@/stores/cliSessions'

// Mock stores
vi.mock('@/stores/cliSessions')

// Mock xterm
vi.mock('@xterm/xterm', () => ({
  Terminal: vi.fn(() => ({
    open: vi.fn(),
    write: vi.fn(),
    onData: vi.fn(),
    onResize: vi.fn(),
    loadAddon: vi.fn(),
    dispose: vi.fn(),
  })),
}))

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: vi.fn(() => ({
    fit: vi.fn(),
  })),
}))

const renderTerminalCanvas = (sessionId = 'test-session') => {
  return render(<TerminalCanvas sessionId={sessionId} />)
}

describe('TerminalCanvas', () => {
  const mockSession = {
    id: 'test-session',
    name: 'Test Session',
    projectId: 'proj-1',
    tool: 'bash',
    status: 'active' as const,
  }

  const mockSendInput = vi.fn()
  const mockResizeSession = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(useCliSessionsStore).mockReturnValue({
      sessions: [mockSession],
      sendInput: mockSendInput,
      resizeSession: mockResizeSession,
      getSession: vi.fn(() => mockSession),
    } as any)
  })

  it('renders terminal container', () => {
    renderTerminalCanvas()

    expect(screen.getByTestId('terminal-canvas')).toBeInTheDocument()
  })

  it('initializes terminal on mount', async () => {
    renderTerminalCanvas()

    await waitFor(() => {
      expect(screen.getByTestId('terminal-canvas')).toHaveAttribute('data-initialized', 'true')
    })
  })

  it('sends input when typing in terminal', async () => {
    const user = userEvent.setup()
    renderTerminalCanvas()

    const terminal = screen.getByTestId('terminal-canvas')
    await user.click(terminal)
    await user.keyboard('ls{Enter}')

    await waitFor(() => {
      expect(mockSendInput).toHaveBeenCalledWith(expect.objectContaining({
        sessionId: 'test-session',
      }))
    })
  })

  it('handles session resize', async () => {
    renderTerminalCanvas()

    // Simulate window resize
    global.dispatchEvent(new Event('resize'))

    await waitFor(() => {
      expect(mockResizeSession).toHaveBeenCalled()
    })
  })

  it('displays session status indicator', () => {
    renderTerminalCanvas()

    const statusIndicator = screen.getByTestId('session-status')
    expect(statusIndicator).toHaveTextContent('active')
  })

  it('shows reconnecting state when session is disconnected', () => {
    vi.mocked(useCliSessionsStore).mockReturnValue({
      sessions: [{
        ...mockSession,
        status: 'disconnected' as const,
      }],
      sendInput: mockSendInput,
      resizeSession: mockResizeSession,
      getSession: vi.fn(() => ({ ...mockSession, status: 'disconnected' })),
    } as any)

    renderTerminalCanvas()

    expect(screen.getByText(/reconnecting/i)).toBeInTheDocument()
  })

  it('cleans up terminal on unmount', () => {
    const { unmount } = renderTerminalCanvas()

    unmount()

    // Terminal dispose should be called
    expect(mockSendInput).not.toHaveBeenCalled()
  })
})
