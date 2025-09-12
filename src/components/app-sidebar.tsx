import * as React from "react"
import {
  BotIcon,
  CodeIcon,
  FolderIcon,
  GitBranchIcon,
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
  path: (projectId: string) => string
}

type DocumentLink = {
  name: string
  icon: LucideIcon
  path: (projectId: string) => string
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
  { title: "Dashboard", icon: LayoutDashboardIcon, path: (id) => `/projects/${id}` },
  { title: "Chat Sessions", icon: MessageSquareIcon, path: (id) => `/projects/${id}/sessions` },
  { title: "Git Operations", icon: GitBranchIcon, path: (id) => `/projects/${id}/git` },
  { title: "Agents", icon: BotIcon, path: (id) => `/projects/${id}/agents` },
]

const projectDocuments: readonly DocumentLink[] = [
  { name: "File Browser", icon: CodeIcon, path: (id) => `/projects/${id}/files` },
  { name: "Terminal", icon: TerminalIcon, path: (id) => `/projects/${id}/terminal` },
]

const projectSecondary: readonly ProjectLink[] = [
  { title: "Settings", icon: SettingsIcon, path: (id) => `/projects/${id}/settings` },
  { title: "Help", icon: HelpCircleIcon, path: (_id) => `#` },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const currentProject = useCurrentProject()
  const location = useLocation()
  const match = /\/projects\/([^/]+)/.exec(location.pathname)
  const projectIdFromPath = match?.[1]
  const projectId = currentProject?.id || projectIdFromPath
  const hasProject = Boolean(projectId)
  const instanceRunning = Boolean(currentProject?.instance && currentProject.instance.status === "running")

  const mainItems = React.useMemo(() => {
    if (!hasProject || !projectId) return [...globalMainNav]
    return [
      ...globalMainNav,
      ...projectMainNav.map((item) => ({ title: item.title, url: item.path(projectId), icon: item.icon })),
    ]
  }, [hasProject, projectId])

  const documentItems = React.useMemo(() => {
    if (!hasProject || !projectId) return [] as { name: string; url: string; icon: LucideIcon }[]
    const docs = projectDocuments
      .filter((doc) => {
        // Hide Terminal unless instance is running
        if (doc.name === "Terminal" && !instanceRunning) return false
        return true
      })
      .map((doc) => ({ name: doc.name, url: doc.path(projectId), icon: doc.icon }))
    return docs
  }, [hasProject, projectId, instanceRunning])

  const secondaryItems = React.useMemo(() => {
    if (!hasProject || !projectId) return [] as { title: string; url: string; icon: LucideIcon }[]
    return projectSecondary.map((item) => ({ title: item.title, url: item.path(projectId), icon: item.icon }))
  }, [hasProject, projectId])

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
