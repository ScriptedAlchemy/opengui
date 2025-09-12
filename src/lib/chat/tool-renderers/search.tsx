import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ui/shadcn-io/ai/tool"
import { ToolPart } from "@opencode-ai/sdk/client"
import { FolderIcon, FileIcon, SearchIcon } from "lucide-react"
import { renderDefaultTool } from "./default"

export const renderListTool = (message: ToolPart) => {
  const state = message.state

  if (state.status === "completed") {
    const input = state.input as { path?: string }
    const output = state.output || ""
    const items = output.split("\n").filter(Boolean)

    return (
      <Tool defaultOpen={false}>
        <ToolHeader type={message.tool} state={state} />
        <ToolContent>
          <ToolInput input={input} />
          <ToolOutput
            output={
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <FolderIcon className="text-muted-foreground size-4" />
                  <span className="text-sm font-medium">{input.path || "Current Directory"}</span>
                </div>
                <ScrollArea className="bg-muted/30 h-[300px] w-full rounded-md border">
                  <div className="space-y-1 p-4">
                    {items.map((item, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        {item.includes("/") ? (
                          <FolderIcon className="text-muted-foreground size-3" />
                        ) : (
                          <FileIcon className="text-muted-foreground size-3" />
                        )}
                        <span className="font-mono text-xs">{item}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
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

export const renderSearchTool = (message: ToolPart) => {
  const state = message.state

  if (state.status === "completed") {
    const input = state.input as { pattern?: string; path?: string; include?: string }
    const output = state.output || ""
    const matches = output.split("\n").filter(Boolean)

    return (
      <Tool defaultOpen={false}>
        <ToolHeader type={message.tool} state={state} />
        <ToolContent>
          <ToolInput input={input} />
          <ToolOutput
            output={
              <div className="space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <SearchIcon className="text-muted-foreground size-4" />
                    <span className="text-sm font-medium">Pattern: {input.pattern}</span>
                  </div>
                  {input.path && (
                    <p className="text-muted-foreground text-xs">Path: {input.path}</p>
                  )}
                  {input.include && (
                    <p className="text-muted-foreground text-xs">Include: {input.include}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <h4 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    {matches.length} matches found
                  </h4>
                  <ScrollArea className="bg-muted/30 h-[300px] w-full rounded-md border">
                    <div className="space-y-1 p-4">
                      {matches.map((match, i) => (
                        <div key={i} className="font-mono text-xs">
                          {match}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
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
