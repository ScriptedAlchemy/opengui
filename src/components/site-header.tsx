import { useLocation, useParams } from "react-router-dom"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"

const PATH_TITLES: Array<{ predicate: (path: string) => boolean; title: string }> = [
  { predicate: (path) => path === "/", title: "Operations Hub" },
  { predicate: (path) => path.endsWith("/github") || path === "/github", title: "GitHub Integration" },
]

function resolveTitle(pathname: string): string {
  for (const { predicate, title } of PATH_TITLES) {
    if (predicate(pathname)) return title
  }
  return "Operator Hub"
}

export function SiteHeader() {
  const location = useLocation()
  const { projectId, worktreeId } = useParams()
  const title = resolveTitle(location.pathname)

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />
        <h1 className="text-base font-medium">{title}</h1>
        {projectId ? (
          <>
            <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />
            <span className="text-muted-foreground text-sm">
              {projectId}
              {worktreeId ? ` · ${worktreeId}` : ""}
            </span>
          </>
        ) : null}
      </div>
    </header>
  )
}
