/* @jsxImportSource react */
import { Component, ErrorInfo, ReactNode } from "react"
import { Outlet } from "react-router-dom"
import { cn } from "../../lib/utils"

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
}

interface ErrorBoundaryProps {
  children: ReactNode
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Error boundary caught an error:", error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-background flex h-screen items-center justify-center text-white">
          <div className="text-center">
            <h1 className="mb-4 text-2xl font-bold">Something went wrong</h1>
            <p className="mb-4 text-gray-400">
              {this.state.error?.message || "An unexpected error occurred"}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: undefined })}
              className="rounded-md bg-blue-600 px-4 py-2 transition-colors hover:bg-blue-700"
            >
              Try again
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

interface RootLayoutProps {
  className?: string
}

export function RootLayout({ className }: RootLayoutProps) {
  return (
    <ErrorBoundary>
      <main
        id="main"
        role="main"
        className={cn("bg-background flex h-screen text-white", className)}
      >
        <Outlet />
      </main>
    </ErrorBoundary>
  )
}
