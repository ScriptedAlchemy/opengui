import { useState } from "react"
import { Plus, PanelLeftClose, PanelLeftOpen } from "lucide-react"
import { cn } from "../../lib/utils"

interface SidebarProps {
  className?: string
}

export function Sidebar({ className }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed)
  }

  return (
    <div
      className={cn(
        "bg-sidebar border-border flex h-full flex-col border-r transition-all duration-300",
        isCollapsed ? "w-16" : "w-64",
        className
      )}
    >
      {/* Header with New Chat button and toggle */}
      <div className="border-border flex items-center justify-between border-b p-4">
        {!isCollapsed && (
          <button className="bg-accent hover:bg-accent/80 text-accent-foreground mr-2 flex flex-1 items-center gap-2 rounded-md px-3 py-2 transition-colors">
            <Plus className="h-4 w-4" />
            <span className="text-sm font-medium">New Chat</span>
          </button>
        )}

        {isCollapsed && (
          <button className="bg-accent hover:bg-accent/80 text-accent-foreground mx-auto flex h-8 w-8 items-center justify-center rounded-md transition-colors">
            <Plus className="h-4 w-4" />
          </button>
        )}

        <button
          onClick={toggleCollapse}
          className={cn(
            "hover:bg-muted flex h-8 w-8 items-center justify-center rounded-md transition-colors",
            isCollapsed && "mx-auto mt-2"
          )}
        >
          {isCollapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Session List Section */}
      <div className="flex-1 p-4">
        <div className="text-muted-foreground text-sm">
          {isCollapsed ? null : "Session list will go here"}
        </div>
      </div>

      {/* Project Switcher at bottom */}
      <div className="border-border border-t p-4">
        <div className="text-muted-foreground text-sm">
          {isCollapsed ? null : "Project switcher will go here"}
        </div>
      </div>
    </div>
  )
}
