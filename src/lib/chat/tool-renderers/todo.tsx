import { Badge } from "@/components/ui/badge"
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ui/shadcn-io/ai/tool"
import { cn } from "@/lib/utils"
import { ToolPart } from "@opencode-ai/sdk/client"
import { CheckCircleIcon, XCircleIcon, ClockIcon, CircleIcon } from "lucide-react"
import { renderDefaultTool } from "./default"

export const renderTodoTool = (message: ToolPart) => {
  const state = message.state

  if (state.status === "completed") {
    const input = state.input as {
      todos?: Array<{ content: string; status: string; priority: string; id: string }>
    }

    if (message.tool === "todowrite" && input.todos) {
      return (
        <Tool defaultOpen={false}>
          <ToolHeader type={message.tool} state={state} />
          <ToolContent>
            <ToolInput input={input} />
            <ToolOutput
              output={
                <div className="space-y-3">
                  <h4 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    Todo List Updated
                  </h4>
                  <div className="space-y-2">
                    {input.todos.map((todo) => (
                      <div key={todo.id} className="flex items-center gap-2">
                        {todo.status === "completed" ? (
                          <CheckCircleIcon className="size-4 text-green-600" />
                        ) : todo.status === "in_progress" ? (
                          <ClockIcon className="size-4 text-blue-600" />
                        ) : todo.status === "cancelled" ? (
                          <XCircleIcon className="size-4 text-red-600" />
                        ) : (
                          <CircleIcon className="text-muted-foreground size-4" />
                        )}
                        <span
                          className={cn(
                            "text-sm",
                            todo.status === "completed" && "text-muted-foreground line-through"
                          )}
                        >
                          {todo.content}
                        </span>
                        <Badge variant="outline" className="ml-auto text-xs">
                          {todo.priority}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              }
              errorText={null}
            />
          </ToolContent>
        </Tool>
      )
    }

    return renderDefaultTool(message)
  }

  return renderDefaultTool(message)
}
