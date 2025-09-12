import { Badge } from "@/components/ui/badge"
import { Task, TaskContent, TaskTrigger } from "@/components/ui/shadcn-io/ai/task"
import { Loader } from "@/components/ui/shadcn-io/ai/loader"
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ui/shadcn-io/ai/tool"
import { ToolPart, ToolStateRunning, ToolStateCompleted } from "@opencode-ai/sdk/client"
import { renderDefaultTool } from "./default"

// Forward declaration - will be set by index.tsx to avoid circular dependency
let renderToolCallback: ((message: ToolPart) => React.ReactNode) | null = null

export const setRenderToolCallback = (callback: (message: ToolPart) => React.ReactNode) => {
  renderToolCallback = callback
}

// Render nested tool calls from task metadata
const renderTaskToolCalls = (toolParts: ToolPart[]): React.ReactNode => {
  if (!toolParts || toolParts.length === 0 || !renderToolCallback) return null

  return (
    <div className="space-y-2">
      <h4 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        Agent Tool Calls
      </h4>
      <div className="space-y-2">
        {toolParts.map((part) => (
          <div key={part.id} className="border-muted border-l-2 pl-3">
            {renderToolCallback!(part)}
          </div>
        ))}
      </div>
    </div>
  )
}

export const renderTaskTool = (message: ToolPart) => {
  const state = message.state

  if (state.status === "completed") {
    const input = state.input as { description?: string; prompt?: string; subagent_type?: string }
    const output = state.output || ""
    const metadata = (state as ToolStateCompleted).metadata as { summary?: ToolPart[] }

    return (
      <Task defaultOpen={false}>
        <TaskTrigger title={input.description || "Agent Task"} />
        <TaskContent>
          <Tool>
            <ToolHeader type={message.tool} state={state} />
            <ToolContent>
              <ToolInput input={input} />
              <ToolOutput
                output={
                  <div className="space-y-3">
                    {input.subagent_type && (
                      <Badge variant="secondary" className="text-xs">
                        Agent: {input.subagent_type}
                      </Badge>
                    )}
                    {input.prompt && (
                      <div className="space-y-2">
                        <h4 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                          Prompt
                        </h4>
                        <p className="text-sm">{input.prompt}</p>
                      </div>
                    )}
                    {metadata?.summary && renderTaskToolCalls(metadata.summary)}
                    {output && (
                      <div className="space-y-2">
                        <h4 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                          Result
                        </h4>
                        <div className="text-sm whitespace-pre-wrap">{output}</div>
                      </div>
                    )}
                  </div>
                }
                errorText={null}
              />
            </ToolContent>
          </Tool>
        </TaskContent>
      </Task>
    )
  }

  if (state.status === "running") {
    const runningState = state as ToolStateRunning
    const metadata = runningState.metadata as { metadata?: { summary?: ToolPart[] } }
    const summary = metadata?.metadata?.summary

    return (
      <Task defaultOpen={true}>
        <TaskTrigger title={runningState.title || "Running Agent Task"} />
        <TaskContent>
          <Tool>
            <ToolHeader type={message.tool} state={state} />
            <ToolContent>
              {runningState.input ? (
                <ToolInput input={runningState.input as unknown as React.ReactNode} />
              ) : null}
              <ToolOutput
                output={
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Loader size={16} />
                      <span className="text-muted-foreground text-sm">Agent is working...</span>
                    </div>
                    {summary && renderTaskToolCalls(summary)}
                  </div>
                }
                errorText={null}
              />
            </ToolContent>
          </Tool>
        </TaskContent>
      </Task>
    )
  }

  return renderDefaultTool(message)
}
