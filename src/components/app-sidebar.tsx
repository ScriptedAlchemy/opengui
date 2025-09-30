import * as React from "react"
import { GithubIcon, LayoutDashboardIcon, SettingsIcon, ZapIcon } from "lucide-react"

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
import { useLocation, Link } from "react-router-dom"

const userData = {
  name: "Developer",
  email: "dev@agent-orange.local",
  avatar: "/avatars/developer.jpg",
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const currentProject = useCurrentProject()
  const location = useLocation()

  const projectId = currentProject?.id ?? null
  const worktreeMatch = React.useMemo(
    () => /\/projects\/[^/]+\/([^/]+)/.exec(location.pathname) ?? null,
    [location.pathname]
  )
  const activeWorktreeId = worktreeMatch?.[1] || "default"

  const mainItems = React.useMemo(
    () => [
      {
        title: "Operations Hub",
        url: "/",
        icon: LayoutDashboardIcon,
      },
      {
        title: "GitHub",
        url: projectId ? `/projects/${projectId}/${activeWorktreeId}/github` : "/github",
        icon: GithubIcon,
      },
    ],
    [projectId, activeWorktreeId]
  )

  const secondaryItems = React.useMemo(
    () =>
      projectId
        ? [
            {
              title: "Project Settings",
              url: "#",
              icon: SettingsIcon,
            },
          ]
        : [],
    [projectId]
  )

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
              <Link to="/">
                <ZapIcon className="h-5 w-5" />
                <span className="text-base font-semibold">Operator Hub</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent data-testid="sidebar-content">
        <NavMain items={mainItems} />
        {secondaryItems.length > 0 ? <NavSecondary items={secondaryItems} className="mt-auto" /> : null}
      </SidebarContent>
      <SidebarFooter data-testid="sidebar-footer">
        <NavUser user={userData} />
      </SidebarFooter>
    </Sidebar>
  )
}
