import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Edit2, Trash2, Check, X } from "lucide-react"
import { SessionInfo } from "@/types/chat"

interface SessionItemProps {
  session: SessionInfo
  isActive: boolean
  onSelect: (sessionId: string) => void
  onRename: (sessionId: string, newTitle: string) => void
  onDelete: (sessionId: string) => void
}

export const SessionItem: React.FC<SessionItemProps> = ({
  session,
  isActive,
  onSelect,
  onRename,
  onDelete,
}) => {
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(session.title)

  const handleRenameStart = () => {
    setIsRenaming(true)
    setRenameValue(session.title)
  }

  const handleRenameConfirm = () => {
    if (renameValue.trim() && renameValue !== session.title) {
      onRename(session.id, renameValue.trim())
    }
    setIsRenaming(false)
  }

  const handleRenameCancel = () => {
    setIsRenaming(false)
    setRenameValue(session.title)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleRenameConfirm()
    } else if (e.key === "Escape") {
      handleRenameCancel()
    }
  }

  return (
    <div
      className={`group hover:bg-accent flex cursor-pointer items-center gap-2 rounded-lg p-2 ${
        isActive ? "bg-accent" : ""
      }`}
      onClick={() => !isRenaming && onSelect(session.id)}
      data-testid="session-item"
    >
      {isRenaming ? (
        <>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="h-8 flex-1"
            autoFocus
            onClick={(e) => e.stopPropagation()}
            data-testid="input-session-rename"
          />
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation()
              handleRenameConfirm()
            }}
            className="h-8 w-8 p-0"
            data-testid="button-session-rename-confirm"
          >
            <Check className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation()
              handleRenameCancel()
            }}
            className="h-8 w-8 p-0"
            data-testid="button-session-rename-cancel"
          >
            <X className="h-3 w-3" />
          </Button>
        </>
      ) : (
        <>
          <span className="flex-1 truncate text-sm">{session.title}</span>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100">
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation()
                handleRenameStart()
              }}
              className="h-8 w-8 p-0"
              data-testid="button-session-edit"
            >
              <Edit2 className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation()
                onDelete(session.id)
              }}
              className="text-destructive hover:text-destructive h-8 w-8 p-0"
              data-testid="button-session-delete"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
