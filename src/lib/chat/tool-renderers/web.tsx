import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ui/shadcn-io/ai/tool"
import { ToolPart } from "@opencode-ai/sdk/client"
import { ExternalLinkIcon } from "lucide-react"
import { renderDefaultTool } from "./default"

export const renderWebFetchTool = (message: ToolPart) => {
  const state = message.state

  if (state.status === "completed") {
    const input = state.input as { url?: string }
    const metadata = state.metadata as { content?: string; title?: string; statusCode?: number }

    const content = metadata?.content || ""
    const truncated = content.length > 3000
    const displayContent = truncated
      ? content.slice(0, 3000) + "\n... (content truncated)"
      : content

    return (
      <Tool defaultOpen={false}>
        <ToolHeader type={message.tool} state={state} />
        <ToolContent>
          <ToolInput input={input} />
          <ToolOutput
            output={
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ExternalLinkIcon className="text-muted-foreground size-4" />
                    <a
                      href={input.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-blue-600 underline hover:text-blue-800"
                    >
                      {metadata?.title || input.url}
                    </a>
                  </div>
                  {metadata?.statusCode && (
                    <Badge
                      variant={metadata.statusCode === 200 ? "default" : "destructive"}
                      className="text-xs"
                    >
                      {metadata.statusCode}
                    </Badge>
                  )}
                </div>
                {displayContent && (
                  <ScrollArea className="bg-muted/30 h-[400px] w-full rounded-md border">
                    <pre className="p-4 font-mono text-xs whitespace-pre-wrap">
                      {displayContent}
                    </pre>
                  </ScrollArea>
                )}
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
