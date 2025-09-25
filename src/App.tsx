import WorktreeSessionSync from "./components/system/WorktreeSessionSync"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { useEffect } from "react"
import { loader as monacoLoader } from "@monaco-editor/react"
import { ThemeProvider } from "next-themes"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { AppSidebar } from "./components/app-sidebar"
import { SiteHeader } from "./components/site-header"
import { SidebarProvider, SidebarInset } from "./components/ui/sidebar"
import { OpencodeSDKProvider } from "./contexts/OpencodeSDKContext"
import { Toaster } from "./components/ui/sonner"

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
import GitHubIntegration from "./pages/GitHubIntegration"
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
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="@container/main flex min-h-0 flex-1 flex-col">
            <main className="min-h-0 flex-1 overflow-auto">
              <Routes>
                {/* Root route - Project list */}
                <Route index element={<ProjectList />} />

                {/* Project-specific routes */}
                <Route path="projects/:projectId">
                  <Route index element={<Navigate to="default" replace />} />
                  <Route path=":worktreeId">
                    <Route index element={<ProjectDashboard />} />
                    <Route path="sessions" element={<SessionList />} />
                    <Route path="sessions/:sessionId/chat" element={<ChatInterface />} />
                    <Route path="git" element={<GitOperations />} />
                    <Route path="github" element={<GitHubIntegration />} />
                    <Route path="agents" element={<AgentManagement />} />
                    <Route path="files/*" element={<FileBrowser />} />
                    <Route path="terminal" element={<Terminal />} />
                    <Route path="settings" element={<ProjectSettings />} />
                  </Route>
                </Route>

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
  const disableToasts =
    typeof process !== "undefined" &&
    typeof process.env !== "undefined" &&
    process.env.OPENCODE_TEST_MODE === "1"

  // Pre-initialize Monaco editor to avoid async "Loading..." overlay
  // and stabilize visual snapshots across environments.
  useEffect(() => {
    // monacoLoader.init() is idempotent; safe to call once at startup.
    void monacoLoader.init().catch(() => {})
  }, [])
  return (
    <OpencodeSDKProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <BrowserRouter
            future={{
              v7_startTransition: true,
              v7_relativeSplatPath: true,
            }}
          >
            <div className="bg-background text-foreground min-h-screen">
              <WorktreeSessionSync />
              <DashboardLayout />
              {/* Global toast notifications */}
              {disableToasts ? null : <Toaster position="top-right" richColors />}
            </div>
          </BrowserRouter>
        </ThemeProvider>
      </QueryClientProvider>
    </OpencodeSDKProvider>
  )
}

export default App
