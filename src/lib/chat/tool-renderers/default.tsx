import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ui/shadcn-io/ai/tool"
import { Loader } from "@/components/ui/shadcn-io/ai/loader"
import {
  ToolPart,
  ToolStateCompleted,
  ToolStateError,
  ToolStateRunning,
} from "@opencode-ai/sdk/client"

export const renderDefaultTool = (message: ToolPart) => {
  const state = message.state

  return (
    <Tool defaultOpen={state.status === "error"}>
      <ToolHeader type={message.tool} state={state} />
      <ToolContent>
        {state.status === "pending" && (
          <div className="flex items-center gap-2 p-4">
            <Loader size={16} />
            <span className="text-muted-foreground text-sm">Preparing {message.tool}...</span>
          </div>
        )}
        {state.status === "running" && (
          <div className="space-y-3 p-4">
            <div className="flex items-center gap-2">
              <Loader size={16} />
              <span className="text-muted-foreground text-sm">
                {(state as ToolStateRunning).title || `Running ${message.tool}...`}
              </span>
            </div>
            {(state as ToolStateRunning).input ? (
              <ToolInput input={(state as ToolStateRunning).input} />
            ) : null}
          </div>
        )}
        {state.status === "completed" && (
          <div className="space-y-3 p-4">
            <ToolInput input={(state as ToolStateCompleted).input} />
            <ToolOutput
              output={String((state as ToolStateCompleted).output || "")}
              errorText={null}
            />
          </div>
        )}
        {state.status === "error" && (
          <div className="space-y-3 p-4">
            <ToolInput input={(state as ToolStateError).input} />
            <div className="bg-destructive/10 rounded-md p-3">
              <p className="text-destructive text-sm">{(state as ToolStateError).error}</p>
            </div>
          </div>
        )}
      </ToolContent>
    </Tool>
  )
}
