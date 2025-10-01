import { describe, it, expect, vi, beforeEach } from '@rstest/core'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { ProjectRail } from '@/features/projects/ProjectRail'
import { useProjects, useProjectsActions, useCurrentProject } from '@/stores/projects'

// Mock stores
vi.mock('@/stores/projects')

const renderProjectRail = () => {
  return render(
    <BrowserRouter>
      <ProjectRail />
    </BrowserRouter>
  )
}

describe('ProjectRail', () => {
  const mockProjects = [
    { id: 'proj-1', name: 'Project Alpha', path: '/path/to/alpha' },
    { id: 'proj-2', name: 'Project Beta', path: '/path/to/beta' },
    { id: 'proj-3', name: 'Project Gamma', path: '/path/to/gamma' },
  ]

  const mockSelectProject = vi.fn()
  const mockAddProject = vi.fn()
  const mockRemoveProject = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(useProjects).mockReturnValue(mockProjects as any)
    vi.mocked(useCurrentProject).mockReturnValue(null)
    vi.mocked(useProjectsActions).mockReturnValue({
      selectProject: mockSelectProject,
      addProject: mockAddProject,
      removeProject: mockRemoveProject,
      loadProjects: vi.fn(),
    })
  })

  it('renders list of projects', () => {
    renderProjectRail()

    expect(screen.getByText('Project Alpha')).toBeInTheDocument()
    expect(screen.getByText('Project Beta')).toBeInTheDocument()
    expect(screen.getByText('Project Gamma')).toBeInTheDocument()
  })

  it('displays add project button', () => {
    renderProjectRail()

    const addButton = screen.getByRole('button', { name: /add project/i })
    expect(addButton).toBeInTheDocument()
  })

  it('selects project when clicked', async () => {
    const user = userEvent.setup()
    renderProjectRail()

    const projectItem = screen.getByText('Project Alpha')
    await user.click(projectItem)

    expect(mockSelectProject).toHaveBeenCalledWith('proj-1')
  })

  it('highlights currently selected project', () => {
    vi.mocked(useCurrentProject).mockReturnValue(mockProjects[0] as any)
    renderProjectRail()

    const selectedItem = screen.getByText('Project Alpha').closest('[data-selected]')
    expect(selectedItem).toHaveAttribute('data-selected', 'true')
  })

  it('shows empty state when no projects', () => {
    vi.mocked(useProjects).mockReturnValue([])
    renderProjectRail()

    expect(screen.getByText(/no projects/i)).toBeInTheDocument()
  })

  it('opens add project dialog when add button is clicked', async () => {
    const user = userEvent.setup()
    renderProjectRail()

    const addButton = screen.getByRole('button', { name: /add project/i })
    await user.click(addButton)

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
  })

  it('displays project paths as tooltips', async () => {
    const user = userEvent.setup()
    renderProjectRail()

    const projectItem = screen.getByText('Project Alpha')
    await user.hover(projectItem)

    await waitFor(() => {
      expect(screen.getByText('/path/to/alpha')).toBeInTheDocument()
    })
  })
})
