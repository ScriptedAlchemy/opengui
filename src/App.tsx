import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { ThemeProvider } from "next-themes"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { AppSidebar } from "./components/app-sidebar"
import { SiteHeader } from "./components/site-header"
import { SidebarProvider, SidebarInset } from "./components/ui/sidebar"
import { Toaster } from "./components/ui/sonner"
import OperationsHub from "./pages/OperationsHub"
import GitHubIntegration from "./pages/GitHubIntegration"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 3 * 60 * 1000,
      gcTime: 6 * 60 * 1000,
    },
    mutations: {
      retry: 1,
    },
  },
})

function Layout() {
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
        <main className="min-h-0 flex-1 overflow-hidden bg-background">
          <Routes>
            <Route index element={<OperationsHub />} />
            <Route path="github" element={<GitHubIntegration />} />
            <Route path="projects/:projectId/:worktreeId/github" element={<GitHubIntegration />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

function App() {
  const disableToasts =
    typeof process !== "undefined" &&
    typeof process.env !== "undefined" &&
    process.env.AGENT_ORANGE_TEST_MODE === "1"

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <BrowserRouter>
          <div className="bg-background text-foreground min-h-screen">
            <Layout />
            {disableToasts ? null : <Toaster position="top-right" richColors />}
          </div>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

export default App
