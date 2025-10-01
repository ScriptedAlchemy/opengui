import { describe, it, expect, vi, beforeEach } from '@rstest/core'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WorktreeBoard } from '@/features/worktrees/WorktreeBoard'
import { useWorktreesForProject } from '@/stores/worktrees'
import { useCurrentProject } from '@/stores/projects'

// Mock stores
vi.mock('@/stores/worktrees')
vi.mock('@/stores/projects')

const renderWorktreeBoard = () => {
  return render(<WorktreeBoard />)
}

describe('WorktreeBoard', () => {
  const mockWorktrees = [
    {
      id: 'wt-1',
      name: 'main',
      path: '/project/main',
      branch: 'main',
      isMain: true,
    },
    {
      id: 'wt-2',
      name: 'feature-auth',
      path: '/project/worktrees/feature-auth',
      branch: 'feature/auth',
      isMain: false,
    },
    {
      id: 'wt-3',
      name: 'bugfix-login',
      path: '/project/worktrees/bugfix-login',
      branch: 'bugfix/login',
      isMain: false,
    },
  ]

  const mockProject = {
    id: 'proj-1',
    name: 'Test Project',
    path: '/project',
  }

  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(useCurrentProject).mockReturnValue(mockProject as any)
    vi.mocked(useWorktreesForProject).mockReturnValue(mockWorktrees as any)
  })

  it('renders list of worktrees', () => {
    renderWorktreeBoard()

    expect(screen.getByText('main')).toBeInTheDocument()
    expect(screen.getByText('feature-auth')).toBeInTheDocument()
    expect(screen.getByText('bugfix-login')).toBeInTheDocument()
  })

  it('displays branch names for each worktree', () => {
    renderWorktreeBoard()

    expect(screen.getByText('main')).toBeInTheDocument()
    expect(screen.getByText('feature/auth')).toBeInTheDocument()
    expect(screen.getByText('bugfix/login')).toBeInTheDocument()
  })

  it('marks main worktree with indicator', () => {
    renderWorktreeBoard()

    const mainWorktree = screen.getByText('main').closest('[data-worktree]')
    expect(mainWorktree).toHaveAttribute('data-is-main', 'true')
  })

  it('shows empty state when no worktrees', () => {
    vi.mocked(useWorktreesForProject).mockReturnValue([])
    renderWorktreeBoard()

    expect(screen.getByText(/no worktrees/i)).toBeInTheDocument()
  })

  it('shows empty state when no project selected', () => {
    vi.mocked(useCurrentProject).mockReturnValue(null)
    renderWorktreeBoard()

    expect(screen.getByText(/select a project/i)).toBeInTheDocument()
  })

  it('displays worktree actions menu', async () => {
    const user = userEvent.setup()
    renderWorktreeBoard()

    const actionButton = screen.getAllByRole('button', { name: /actions/i })[0]
    await user.click(actionButton)

    await waitFor(() => {
      expect(screen.getByText(/open in terminal/i)).toBeInTheDocument()
      expect(screen.getByText(/remove worktree/i)).toBeInTheDocument()
    })
  })

  it('opens create worktree dialog', async () => {
    const user = userEvent.setup()
    renderWorktreeBoard()

    const createButton = screen.getByRole('button', { name: /add worktree/i })
    await user.click(createButton)

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
  })

  it('displays worktree paths on hover', async () => {
    const user = userEvent.setup()
    renderWorktreeBoard()

    const worktreeItem = screen.getByText('feature-auth')
    await user.hover(worktreeItem)

    await waitFor(() => {
      expect(screen.getByText('/project/worktrees/feature-auth')).toBeInTheDocument()
    })
  })

  it('filters worktrees by search query', async () => {
    const user = userEvent.setup()
    renderWorktreeBoard()

    const searchInput = screen.getByPlaceholderText(/search worktrees/i)
    await user.type(searchInput, 'feature')

    expect(screen.getByText('feature-auth')).toBeInTheDocument()
    expect(screen.queryByText('bugfix-login')).not.toBeInTheDocument()
  })
})
