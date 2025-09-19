import * as React from "react"
import {
  BotIcon,
  CodeIcon,
  FolderIcon,
  GitBranchIcon,
  GithubIcon,
  HelpCircleIcon,
  LayoutDashboardIcon,
  MessageSquareIcon,
  SettingsIcon,
  TerminalIcon,
  ZapIcon,
  type LucideIcon,
} from "lucide-react"

import { NavDocuments } from "@/components/nav-documents"
import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { useCurrentProject } from "@/stores/projects"
import { useLocation } from "react-router-dom"

type ProjectLink = {
  title: string
  icon: LucideIcon
  path: (projectId: string, worktreeId: string) => string
}

type DocumentLink = {
  name: string
  icon: LucideIcon
  path: (projectId: string, worktreeId: string) => string
}

const userData = {
  name: "Developer",
  email: "dev@opencode.com",
  avatar: "/avatars/developer.jpg",
}

const globalMainNav = [
  {
    title: "Projects",
    url: "/",
    icon: FolderIcon,
  },
] as const

const projectMainNav: readonly ProjectLink[] = [
  { title: "Dashboard", icon: LayoutDashboardIcon, path: (id, worktree) => `/projects/${id}/${worktree}` },
  { title: "Chat Sessions", icon: MessageSquareIcon, path: (id, worktree) => `/projects/${id}/${worktree}/sessions` },
  { title: "Git Operations", icon: GitBranchIcon, path: (id, worktree) => `/projects/${id}/${worktree}/git` },
  { title: "GitHub", icon: GithubIcon, path: (id, worktree) => `/projects/${id}/${worktree}/github` },
  { title: "Agents", icon: BotIcon, path: (id, worktree) => `/projects/${id}/${worktree}/agents` },
]

const projectDocuments: readonly DocumentLink[] = [
  { name: "File Browser", icon: CodeIcon, path: (id, worktree) => `/projects/${id}/${worktree}/files` },
  { name: "Terminal", icon: TerminalIcon, path: (id, worktree) => `/projects/${id}/${worktree}/terminal` },
]

const projectSecondary: readonly ProjectLink[] = [
  { title: "Settings", icon: SettingsIcon, path: (id, worktree) => `/projects/${id}/${worktree}/settings` },
  { title: "Help", icon: HelpCircleIcon, path: (_id, _worktree) => `#` },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const currentProject = useCurrentProject()
  const location = useLocation()
  const match = /\/projects\/([^/]+)/.exec(location.pathname)
  const projectIdFromPath = match?.[1]
  const projectId = currentProject?.id || projectIdFromPath
  const worktreeMatch = /\/projects\/[^/]+\/([^/]+)/.exec(location.pathname)
  const activeWorktreeId = worktreeMatch?.[1] || "default"
  const hasProject = Boolean(projectId)
  const instanceRunning = Boolean(currentProject?.instance && currentProject.instance.status === "running")

  const mainItems = React.useMemo(() => {
    if (!hasProject || !projectId) return [...globalMainNav]
    return [
      ...globalMainNav,
      ...projectMainNav.map((item) => ({ title: item.title, url: item.path(projectId, activeWorktreeId), icon: item.icon })),
    ]
  }, [hasProject, projectId, activeWorktreeId])

  const documentItems = React.useMemo(() => {
    if (!hasProject || !projectId) return [] as { name: string; url: string; icon: LucideIcon }[]
    const docs = projectDocuments
      .filter((doc) => {
        // Hide Terminal unless instance is running
        if (doc.name === "Terminal" && !instanceRunning) return false
        return true
      })
      .map((doc) => ({ name: doc.name, url: doc.path(projectId, activeWorktreeId), icon: doc.icon }))
    return docs
  }, [hasProject, projectId, instanceRunning, activeWorktreeId])

  const secondaryItems = React.useMemo(() => {
    if (!hasProject || !projectId) return [] as { title: string; url: string; icon: LucideIcon }[]
    return projectSecondary.map((item) => ({ title: item.title, url: item.path(projectId, activeWorktreeId), icon: item.icon }))
  }, [hasProject, projectId, activeWorktreeId])

  return (
    <Sidebar data-testid="project-sidebar" collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              data-testid="sidebar-logo"
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <a href="#">
                <ZapIcon className="h-5 w-5" />
                <span className="text-base font-semibold">OpenCode</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent data-testid="sidebar-content">
        <NavMain items={mainItems} />
        {hasProject && documentItems.length > 0 ? <NavDocuments items={documentItems} /> : null}
        {hasProject && secondaryItems.length > 0 ? (
          <NavSecondary items={secondaryItems} className="mt-auto" />
        ) : null}
      </SidebarContent>
      <SidebarFooter data-testid="sidebar-footer">
        <NavUser user={userData} />
      </SidebarFooter>
    </Sidebar>
  )
}
