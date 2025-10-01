import { describe, it, expect, vi, beforeEach } from '@rstest/core'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CreateSessionDialog } from '@/features/cli/CreateSessionDialog'
import { useCliSessionsStore } from '@/stores/cliSessions'
import { useCurrentProject } from '@/stores/projects'

// Mock stores
vi.mock('@/stores/cliSessions')
vi.mock('@/stores/projects')

const renderCreateSessionDialog = (open = true) => {
  const mockOnOpenChange = vi.fn()
  return render(
    <CreateSessionDialog open={open} onOpenChange={mockOnOpenChange} />
  )
}

describe('CreateSessionDialog', () => {
  const mockCreateSession = vi.fn()
  const mockTools = [
    { id: 'bash', name: 'Bash', command: 'bash' },
    { id: 'zsh', name: 'Zsh', command: 'zsh' },
    { id: 'node', name: 'Node.js REPL', command: 'node' },
  ]

  const mockProject = {
    id: 'proj-1',
    name: 'Test Project',
    path: '/test/project',
  }

  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(useCliSessionsStore).mockReturnValue({
      createSession: mockCreateSession,
      tools: mockTools,
      loadTools: vi.fn(),
    } as any)

    vi.mocked(useCurrentProject).mockReturnValue(mockProject as any)
  })

  it('renders dialog when open', () => {
    renderCreateSessionDialog(true)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/create new session/i)).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    renderCreateSessionDialog(false)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('displays available tools', () => {
    renderCreateSessionDialog()

    expect(screen.getByText('Bash')).toBeInTheDocument()
    expect(screen.getByText('Zsh')).toBeInTheDocument()
    expect(screen.getByText('Node.js REPL')).toBeInTheDocument()
  })

  it('shows session name input', () => {
    renderCreateSessionDialog()

    const nameInput = screen.getByLabelText(/session name/i)
    expect(nameInput).toBeInTheDocument()
  })

  it('creates session with selected tool and name', async () => {
    const user = userEvent.setup()
    renderCreateSessionDialog()

    // Select tool
    const toolSelect = screen.getByRole('combobox', { name: /select tool/i })
    await user.click(toolSelect)
    await user.click(screen.getByText('Bash'))

    // Enter name
    const nameInput = screen.getByLabelText(/session name/i)
    await user.type(nameInput, 'My Dev Session')

    // Submit
    const createButton = screen.getByRole('button', { name: /create/i })
    await user.click(createButton)

    await waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalledWith({
        projectId: 'proj-1',
        tool: 'bash',
        name: 'My Dev Session',
      })
    })
  })

  it('uses default session name if not provided', async () => {
    const user = userEvent.setup()
    renderCreateSessionDialog()

    // Select tool without entering name
    const toolSelect = screen.getByRole('combobox', { name: /select tool/i })
    await user.click(toolSelect)
    await user.click(screen.getByText('Bash'))

    const createButton = screen.getByRole('button', { name: /create/i })
    await user.click(createButton)

    await waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalledWith(
        expect.objectContaining({
          name: expect.stringMatching(/bash session/i),
        })
      )
    })
  })

  it('disables create button when no tool selected', () => {
    renderCreateSessionDialog()

    const createButton = screen.getByRole('button', { name: /create/i })
    expect(createButton).toBeDisabled()
  })

  it('shows error when no project is selected', () => {
    vi.mocked(useCurrentProject).mockReturnValue(null)
    renderCreateSessionDialog()

    expect(screen.getByText(/select a project first/i)).toBeInTheDocument()
  })

  it('closes dialog after successful creation', async () => {
    const user = userEvent.setup()
    const mockOnOpenChange = vi.fn()

    render(
      <CreateSessionDialog open={true} onOpenChange={mockOnOpenChange} />
    )

    // Select tool and create
    const toolSelect = screen.getByRole('combobox', { name: /select tool/i })
    await user.click(toolSelect)
    await user.click(screen.getByText('Bash'))

    const createButton = screen.getByRole('button', { name: /create/i })
    await user.click(createButton)

    await waitFor(() => {
      expect(mockOnOpenChange).toHaveBeenCalledWith(false)
    })
  })
})
