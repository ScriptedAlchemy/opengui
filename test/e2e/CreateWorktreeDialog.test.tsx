import { describe, it, expect, vi, beforeEach } from '@rstest/core'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CreateWorktreeDialog } from '@/features/worktrees/CreateWorktreeDialog'
import { useWorktreesStore } from '@/stores/worktrees'
import { useCurrentProject } from '@/stores/projects'

// Mock stores
vi.mock('@/stores/worktrees')
vi.mock('@/stores/projects')

const renderCreateWorktreeDialog = (open = true) => {
  const mockOnOpenChange = vi.fn()
  return render(
    <CreateWorktreeDialog open={open} onOpenChange={mockOnOpenChange} />
  )
}

describe('CreateWorktreeDialog', () => {
  const mockCreateWorktree = vi.fn()
  const mockBranches = [
    { name: 'main', isLocal: true, isRemote: false },
    { name: 'develop', isLocal: true, isRemote: false },
    { name: 'origin/feature-x', isLocal: false, isRemote: true },
  ]

  const mockProject = {
    id: 'proj-1',
    name: 'Test Project',
    path: '/test/project',
  }

  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(useWorktreesStore).mockReturnValue({
      createWorktree: mockCreateWorktree,
      branches: mockBranches,
      loadBranches: vi.fn(),
    } as any)

    vi.mocked(useCurrentProject).mockReturnValue(mockProject as any)
  })

  it('renders dialog when open', () => {
    renderCreateWorktreeDialog(true)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/create worktree/i)).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    renderCreateWorktreeDialog(false)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('displays branch selection', () => {
    renderCreateWorktreeDialog()

    expect(screen.getByLabelText(/branch/i)).toBeInTheDocument()
  })

  it('displays worktree name input', () => {
    renderCreateWorktreeDialog()

    expect(screen.getByLabelText(/worktree name/i)).toBeInTheDocument()
  })

  it('lists available branches', async () => {
    const user = userEvent.setup()
    renderCreateWorktreeDialog()

    const branchSelect = screen.getByRole('combobox', { name: /select branch/i })
    await user.click(branchSelect)

    expect(screen.getByText('main')).toBeInTheDocument()
    expect(screen.getByText('develop')).toBeInTheDocument()
    expect(screen.getByText('origin/feature-x')).toBeInTheDocument()
  })

  it('creates worktree with selected branch', async () => {
    const user = userEvent.setup()
    renderCreateWorktreeDialog()

    // Select branch
    const branchSelect = screen.getByRole('combobox', { name: /select branch/i })
    await user.click(branchSelect)
    await user.click(screen.getByText('develop'))

    // Enter name
    const nameInput = screen.getByLabelText(/worktree name/i)
    await user.type(nameInput, 'develop-wt')

    // Submit
    const createButton = screen.getByRole('button', { name: /create/i })
    await user.click(createButton)

    await waitFor(() => {
      expect(mockCreateWorktree).toHaveBeenCalledWith({
        projectId: 'proj-1',
        branch: 'develop',
        name: 'develop-wt',
      })
    })
  })

  it('auto-generates worktree name from branch', async () => {
    const user = userEvent.setup()
    renderCreateWorktreeDialog()

    // Select branch
    const branchSelect = screen.getByRole('combobox', { name: /select branch/i })
    await user.click(branchSelect)
    await user.click(screen.getByText('origin/feature-x'))

    // Name should be auto-filled
    const nameInput = screen.getByLabelText(/worktree name/i) as HTMLInputElement
    expect(nameInput.value).toBe('feature-x')
  })

  it('validates worktree name is not empty', async () => {
    const user = userEvent.setup()
    renderCreateWorktreeDialog()

    // Select branch
    const branchSelect = screen.getByRole('combobox', { name: /select branch/i })
    await user.click(branchSelect)
    await user.click(screen.getByText('main'))

    // Clear name
    const nameInput = screen.getByLabelText(/worktree name/i)
    await user.clear(nameInput)

    // Try to create
    const createButton = screen.getByRole('button', { name: /create/i })
    expect(createButton).toBeDisabled()
  })

  it('shows option to create new branch', async () => {
    const user = userEvent.setup()
    renderCreateWorktreeDialog()

    const newBranchCheckbox = screen.getByLabelText(/create new branch/i)
    expect(newBranchCheckbox).toBeInTheDocument()

    await user.click(newBranchCheckbox)

    expect(screen.getByLabelText(/new branch name/i)).toBeInTheDocument()
  })

  it('creates worktree with new branch', async () => {
    const user = userEvent.setup()
    renderCreateWorktreeDialog()

    // Enable new branch
    const newBranchCheckbox = screen.getByLabelText(/create new branch/i)
    await user.click(newBranchCheckbox)

    // Enter new branch name
    const newBranchInput = screen.getByLabelText(/new branch name/i)
    await user.type(newBranchInput, 'feature/new-feature')

    // Enter worktree name
    const nameInput = screen.getByLabelText(/worktree name/i)
    await user.type(nameInput, 'new-feature-wt')

    // Submit
    const createButton = screen.getByRole('button', { name: /create/i })
    await user.click(createButton)

    await waitFor(() => {
      expect(mockCreateWorktree).toHaveBeenCalledWith({
        projectId: 'proj-1',
        branch: 'feature/new-feature',
        name: 'new-feature-wt',
        createBranch: true,
      })
    })
  })

  it('shows error when no project is selected', () => {
    vi.mocked(useCurrentProject).mockReturnValue(null)
    renderCreateWorktreeDialog()

    expect(screen.getByText(/select a project first/i)).toBeInTheDocument()
  })

  it('closes dialog after successful creation', async () => {
    const user = userEvent.setup()
    const mockOnOpenChange = vi.fn()

    render(
      <CreateWorktreeDialog open={true} onOpenChange={mockOnOpenChange} />
    )

    // Select branch and create
    const branchSelect = screen.getByRole('combobox', { name: /select branch/i })
    await user.click(branchSelect)
    await user.click(screen.getByText('main'))

    const nameInput = screen.getByLabelText(/worktree name/i)
    await user.type(nameInput, 'main-wt')

    const createButton = screen.getByRole('button', { name: /create/i })
    await user.click(createButton)

    await waitFor(() => {
      expect(mockOnOpenChange).toHaveBeenCalledWith(false)
    })
  })
})
