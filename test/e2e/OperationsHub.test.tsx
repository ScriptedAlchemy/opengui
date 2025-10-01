import { describe, it, expect, vi, beforeEach } from '@rstest/core'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import OperationsHub from '@/pages/OperationsHub'
import { useProjectsActions, useCurrentProject } from '@/stores/projects'
import { useCliSessionsStore } from '@/stores/cliSessions'
import { useWorktreesForProject } from '@/stores/worktrees'

// Mock stores
vi.mock('@/stores/projects')
vi.mock('@/stores/cliSessions')
vi.mock('@/stores/worktrees')

// Mock child components
vi.mock('@/features/projects/ProjectRail', () => ({
  ProjectRail: () => <div data-testid="project-rail">Project Rail</div>,
}))
vi.mock('@/features/worktrees/WorktreeBoard', () => ({
  WorktreeBoard: () => <div data-testid="worktree-board">Worktree Board</div>,
}))
vi.mock('@/features/cli/CliSessionDock', () => ({
  CliSessionDock: () => <div data-testid="cli-session-dock">CLI Session Dock</div>,
}))
vi.mock('@/features/cli/TerminalCanvas', () => ({
  TerminalCanvas: () => <div data-testid="terminal-canvas">Terminal Canvas</div>,
}))
vi.mock('@/features/worktrees/CreateWorktreeDialog', () => ({
  CreateWorktreeDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="create-worktree-dialog">Create Worktree Dialog</div> : null,
}))
vi.mock('@/features/cli/CreateSessionDialog', () => ({
  CreateSessionDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="create-session-dialog">Create Session Dialog</div> : null,
}))

const renderOperationsHub = () => {
  return render(
    <BrowserRouter>
      <OperationsHub />
    </BrowserRouter>
  )
}

describe('OperationsHub', () => {
  const mockLoadProjects = vi.fn()
  const mockLoadSessions = vi.fn()
  const mockLoadTools = vi.fn()
  const mockCreateSession = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup store mocks
    vi.mocked(useProjectsActions).mockReturnValue({
      loadProjects: mockLoadProjects,
      addProject: vi.fn(),
      removeProject: vi.fn(),
      selectProject: vi.fn(),
    })

    vi.mocked(useCurrentProject).mockReturnValue(null)

    vi.mocked(useCliSessionsStore).mockReturnValue({
      loadSessions: mockLoadSessions,
      createSession: mockCreateSession,
      loadTools: mockLoadTools,
      tools: [],
      sessions: [],
    } as any)

    vi.mocked(useWorktreesForProject).mockReturnValue([])

    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      },
      writable: true,
    })
  })

  it('renders the main layout components', () => {
    renderOperationsHub()

    expect(screen.getByTestId('project-rail')).toBeInTheDocument()
    expect(screen.getByTestId('terminal-canvas')).toBeInTheDocument()
  })

  it('loads projects, sessions, and tools on mount', async () => {
    renderOperationsHub()

    await waitFor(() => {
      expect(mockLoadProjects).toHaveBeenCalledOnce()
      expect(mockLoadSessions).toHaveBeenCalledOnce()
      expect(mockLoadTools).toHaveBeenCalledOnce()
    })
  })

  it('renders command bar with action buttons', () => {
    renderOperationsHub()

    expect(screen.getByTestId('command-bar')).toBeInTheDocument()
    expect(screen.getByTestId('btn-new-session')).toBeInTheDocument()
    expect(screen.getByTestId('btn-new-worktree')).toBeInTheDocument()
    expect(screen.getByTestId('btn-sessions')).toBeInTheDocument()
    expect(screen.getByTestId('btn-worktrees')).toBeInTheDocument()
  })

  it('opens worktrees sheet when button is clicked', async () => {
    const user = userEvent.setup()
    renderOperationsHub()

    const worktreesBtn = screen.getByTestId('btn-worktrees')
    await user.click(worktreesBtn)

    await waitFor(() => {
      expect(screen.getByTestId('worktrees-sheet')).toBeInTheDocument()
    })
  })

  it('opens sessions sheet when button is clicked', async () => {
    const user = userEvent.setup()
    renderOperationsHub()

    const sessionsBtn = screen.getByTestId('btn-sessions')
    await user.click(sessionsBtn)

    await waitFor(() => {
      expect(screen.getByTestId('sessions-sheet')).toBeInTheDocument()
    })
  })

  it('opens create session dialog when new session button is clicked', async () => {
    const user = userEvent.setup()
    renderOperationsHub()

    const newSessionBtn = screen.getByTestId('btn-new-session')
    await user.click(newSessionBtn)

    await waitFor(() => {
      expect(screen.getByTestId('create-session-dialog')).toBeInTheDocument()
    })
  })

  it('opens create worktree dialog when new worktree button is clicked', async () => {
    const user = userEvent.setup()
    renderOperationsHub()

    const newWorktreeBtn = screen.getByTestId('btn-new-worktree')
    await user.click(newWorktreeBtn)

    await waitFor(() => {
      expect(screen.getByTestId('create-worktree-dialog')).toBeInTheDocument()
    })
  })

  describe('keyboard shortcuts', () => {
    it('opens worktrees sheet with Alt+W', async () => {
      const user = userEvent.setup()
      renderOperationsHub()

      await user.keyboard('{Alt>}w{/Alt}')

      await waitFor(() => {
        expect(screen.getByTestId('worktrees-sheet')).toBeInTheDocument()
      })
    })

    it('opens sessions sheet with Alt+S', async () => {
      const user = userEvent.setup()
      renderOperationsHub()

      await user.keyboard('{Alt>}s{/Alt}')

      await waitFor(() => {
        expect(screen.getByTestId('sessions-sheet')).toBeInTheDocument()
      })
    })

    it('opens create session dialog with Alt+N', async () => {
      const user = userEvent.setup()
      renderOperationsHub()

      await user.keyboard('{Alt>}n{/Alt}')

      await waitFor(() => {
        expect(screen.getByTestId('create-session-dialog')).toBeInTheDocument()
      })
    })

    it('opens create worktree dialog with Alt+Shift+N', async () => {
      const user = userEvent.setup()
      renderOperationsHub()

      await user.keyboard('{Alt>}{Shift>}N{/Shift}{/Alt}')

      await waitFor(() => {
        expect(screen.getByTestId('create-worktree-dialog')).toBeInTheDocument()
      })
    })
  })

  describe('project rail resizing', () => {
    it('renders resize handle', () => {
      renderOperationsHub()

      const handle = screen.getByRole('separator', { name: /drag to resize/i })
      expect(handle).toBeInTheDocument()
    })

    it('persists rail width to localStorage', async () => {
      const user = userEvent.setup()
      renderOperationsHub()

      const handle = screen.getByRole('separator', { name: /drag to resize/i })

      // Simulate drag
      await user.pointer([
        { keys: '[MouseLeft>]', target: handle },
        { coords: { x: 350, y: 100 } },
        { keys: '[/MouseLeft]' },
      ])

      expect(localStorage.setItem).toHaveBeenCalled()
    })
  })

  describe('with selected project', () => {
    beforeEach(() => {
      vi.mocked(useCurrentProject).mockReturnValue({
        id: 'test-project',
        name: 'Test Project',
        path: '/test/path',
      } as any)

      vi.mocked(useWorktreesForProject).mockReturnValue([
        { id: 'wt-1', name: 'main', path: '/test/path', branch: 'main' },
        { id: 'wt-2', name: 'feature', path: '/test/path/feature', branch: 'feature' },
      ] as any)
    })

    it('displays worktrees for selected project', () => {
      renderOperationsHub()

      expect(useWorktreesForProject).toHaveBeenCalledWith('test-project')
    })
  })
})
