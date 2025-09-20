import { MailIcon, PlusCircleIcon, type LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { useLocation, useNavigate } from "react-router-dom"

export function NavMain({
  items,
}: {
  items: {
    title: string
    url: string
    icon?: LucideIcon
  }[]
}) {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <SidebarGroup data-testid="nav-main">
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          <SidebarMenuItem className="flex items-center gap-2">
            <SidebarMenuButton
              data-testid="button-quick-create"
              tooltip="Quick Create"
              className="text-primary-foreground hover:text-primary-foreground active:text-primary-foreground min-w-8 duration-200 ease-linear"
            >
              <PlusCircleIcon />
              <span>Quick Create</span>
            </SidebarMenuButton>
            <Button
              data-testid="button-inbox"
              size="icon"
              className="h-9 w-9 shrink-0 group-data-[collapsible=icon]:opacity-0"
              variant="outline"
            >
              <MailIcon />
              <span className="sr-only">Inbox</span>
            </Button>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarMenu data-testid="main-navigation">
          {items.map((item) => {
            const isActive = location.pathname === item.url || location.pathname.startsWith(item.url + "/")
            return (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                data-testid={
                  item.title === "Dashboard"
                    ? "dashboard-nav"
                    : item.title.toLowerCase().includes("sessions")
                    ? "nav-sessions"
                    : `nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`
                }
                tooltip={item.title}
                isActive={isActive}
                onClick={() => {
                  console.log("navigation to", item)
                  return navigate(item.url)
                }}
              >
                {item.icon && <item.icon />}
                <span>{item.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )})}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
