import { render, RenderOptions } from "@testing-library/react"
import { MemoryRouter, Routes, Route } from "react-router-dom"

interface RouterRenderOptions extends Omit<RenderOptions, "wrapper"> {
  initialPath?: string
  projectId?: string
  worktreeId?: string
  sessionId?: string
}

/**
 * Render a component with router context
 * Supports the new worktree-aware route pattern: /projects/:projectId/:worktreeId/...
 */
export function renderWithRouter(
  component: React.ReactElement,
  options: RouterRenderOptions = {}
) {
  const {
    initialPath = "/projects/test-project-id/default",
    projectId = "test-project-id",
    worktreeId = "default",
    sessionId,
    ...renderOptions
  } = options

  // Build the actual path based on provided parameters
  let path = `/projects/${projectId}/${worktreeId}`
  if (sessionId) {
    path += `/sessions/${sessionId}`
  }

  // Use the initial path if provided, otherwise use the built path
  const routerPath = options.initialPath || path

  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <MemoryRouter 
      initialEntries={[routerPath]}
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <Routes>
        <Route path="/projects/:projectId/:worktreeId/*" element={children} />
        <Route path="/projects/:projectId/:worktreeId/sessions/:sessionId/*" element={children} />
        <Route path="/projects/:projectId/:worktreeId" element={children} />
        <Route path="/projects" element={children} />
        <Route path="/" element={children} />
      </Routes>
    </MemoryRouter>
  )

  return render(component, { wrapper: Wrapper, ...renderOptions })
}

/**
 * Create a custom render function for a specific route pattern
 */
export function createRouterRender(defaultPath: string) {
  return (component: React.ReactElement, options?: RouterRenderOptions) =>
    renderWithRouter(component, { initialPath: defaultPath, ...options })
}