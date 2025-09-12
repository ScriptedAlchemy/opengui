import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { AppSidebar } from "./components/app-sidebar"
import { SiteHeader } from "./components/site-header"
import { SidebarProvider, SidebarInset } from "./components/ui/sidebar"
import { OpencodeSDKProvider } from "./contexts/OpencodeSDKContext"

// Import page components directly (no lazy loading since we bundle everything)
import ProjectList from "./pages/ProjectList"
import ProjectDashboard from "./pages/ProjectDashboard"
import SessionList from "./pages/SessionList"
// ChatInterfaceV2 with shadcn AI components and API-only model loading
import ChatInterface from "./pages/ChatInterfaceV2"
import GitOperations from "./pages/GitOperations"
import AgentManagement from "./pages/AgentManagement"
import FileBrowser from "./pages/FileBrowser"
import ProjectSettings from "./pages/ProjectSettings"
import Terminal from "./pages/Terminal"
// Create QueryClient instance with default options
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
    },
    mutations: {
      retry: 1,
    },
  },
})

// No longer needed since we're not using Suspense

// Dashboard layout with modern sidebar
function DashboardLayout() {
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col">
            <main className="flex-1 overflow-auto">
              <Routes>
                {/* Root route - Project list */}
                <Route index element={<ProjectList />} />

                {/* Project-specific routes */}
                <Route path="projects/:projectId" element={<ProjectDashboard />} />
                <Route path="projects/:projectId/sessions" element={<SessionList />} />
                <Route
                  path="projects/:projectId/sessions/:sessionId/chat"
                  element={<ChatInterface />}
                />
                <Route path="projects/:projectId/git" element={<GitOperations />} />
                <Route path="projects/:projectId/agents" element={<AgentManagement />} />
                <Route path="projects/:projectId/files/*" element={<FileBrowser />} />
                <Route path="projects/:projectId/terminal" element={<Terminal />} />
                <Route path="projects/:projectId/settings" element={<ProjectSettings />} />

                {/* Catch-all route */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

function App() {
  return (
    <OpencodeSDKProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <div className="bg-background text-foreground min-h-screen">
            <DashboardLayout />
          </div>
        </BrowserRouter>
      </QueryClientProvider>
    </OpencodeSDKProvider>
  )
}

export default App
