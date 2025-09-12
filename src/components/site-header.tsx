import { useParams, useLocation } from "react-router-dom"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"

export function SiteHeader() {
  const { projectId } = useParams()
  const location = useLocation()

  const getPageTitle = () => {
    const path = location.pathname
    if (path === "/") return "Projects"
    if (path.includes("/sessions")) return "Chat Sessions"
    if (path.includes("/git")) return "Git Operations"
    if (path.includes("/agents")) return "Agents"
    if (path.includes("/files")) return "File Browser"
    if (path.includes("/settings")) return "Settings"
    if (projectId) return "Project Dashboard"
    return "OpenCode"
  }

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />
        <h1 className="text-base font-medium">{getPageTitle()}</h1>
        {projectId && (
          <>
            <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />
            <span className="text-muted-foreground text-sm">Project: {projectId}</span>
          </>
        )}
      </div>
    </header>
  )
}
