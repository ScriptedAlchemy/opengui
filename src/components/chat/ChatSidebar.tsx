import React from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Plus } from "lucide-react"
import { SessionInfo } from "@/types/chat"
import { SessionItem } from "./SessionItem"

interface ChatSidebarProps {
  project: { name?: string; language?: string; description?: string } | null
  sessions: SessionInfo[]
  currentSession: SessionInfo | null
  isLoadingSessions: boolean
  onCreateSession: () => void
  onSelectSession: (session: SessionInfo) => void
  onRenameSession: (sessionId: string, newName: string) => void
  onDeleteSession: (sessionId: string) => void
}

export const ChatSidebar: React.FC<ChatSidebarProps> = ({
  project,
  sessions,
  currentSession,
  isLoadingSessions,
  onCreateSession,
  onSelectSession,
  onRenameSession,
  onDeleteSession,
}) => {
  return (
    <div className="bg-muted/50 flex w-80 flex-col border-r" data-testid="chat-sidebar">
      {/* Project Header */}
      <div className="border-b p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{project?.name || "Loading..."}</h2>
          <Badge variant="outline" className="text-xs">
            {project?.language || "Unknown"}
          </Badge>
        </div>
        {project?.description && (
          <p className="text-muted-foreground mb-3 text-sm">{project.description}</p>
        )}
        <Button
          onClick={onCreateSession}
          className="w-full"
          size="sm"
          data-testid="new-session-button"
        >
          <Plus className="mr-2 h-4 w-4" />
          New Session
        </Button>
      </div>

      <Separator />

      {/* Sessions List */}
      <div className="flex-1 overflow-hidden">
        <div className="p-4 pb-2">
          <h3 className="text-muted-foreground mb-2 text-sm font-medium">Sessions</h3>
        </div>
        <ScrollArea className="flex-1 px-4">
          {isLoadingSessions ? (
            <div className="text-muted-foreground text-sm" data-testid="loading-sessions">
              Loading sessions...
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-muted-foreground text-sm" data-testid="empty-sessions">
              No sessions yet
            </div>
          ) : (
            <div className="space-y-1" data-testid="list-sessions">
              {sessions.map((session) => (
                <SessionItem
                  key={session.id}
                  session={session}
                  isActive={currentSession?.id === session.id}
                  onSelect={(sessionId) => {
                    const session = sessions.find((s) => s.id === sessionId)
                    if (session) onSelectSession(session)
                  }}
                  onRename={onRenameSession}
                  onDelete={onDeleteSession}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  )
}
