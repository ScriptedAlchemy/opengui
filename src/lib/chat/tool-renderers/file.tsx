import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  CodeBlock,
  CodeBlockBody,
  CodeBlockFilename,
  CodeBlockContent,
} from "@/components/ui/shadcn-io/code-block"
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ui/shadcn-io/ai/tool"
import { ToolPart } from "@opencode-ai/sdk/client"
import { FileIcon, FileTextIcon } from "lucide-react"
import { renderDefaultTool } from "./default"

export const renderEditTool = (message: ToolPart) => {
  const state = message.state

  if (state.status === "completed") {
    const input = state.input as { filePath?: string; oldString?: string; newString?: string }
    const metadata = state.metadata as { diff?: string }

    return (
      <Tool defaultOpen={false}>
        <ToolHeader type={message.tool} state={state} />
        <ToolContent>
          <ToolInput input={input} />
          <ToolOutput
            output={
              <div className="space-y-3">
                {input.filePath && (
                  <div className="flex items-center gap-2">
                    <FileIcon className="text-muted-foreground size-4" />
                    <span className="text-sm font-medium">{input.filePath}</span>
                  </div>
                )}
                {metadata?.diff && (
                  <CodeBlock
                    data={[
                      {
                        language: "diff",
                        filename: input.filePath || "",
                        code: metadata.diff,
                      },
                    ]}
                  >
                    <CodeBlockFilename value={input.filePath || ""}>
                      {input.filePath || ""}
                    </CodeBlockFilename>
                    <CodeBlockBody>
                      {(item) => (
                        <CodeBlockContent key={item.filename} language={item.language}>
                          {item.code}
                        </CodeBlockContent>
                      )}
                    </CodeBlockBody>
                  </CodeBlock>
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

export const renderReadTool = (message: ToolPart) => {
  const state = message.state

  if (state.status === "completed") {
    const input = state.input as { filePath?: string; offset?: number; limit?: number }
    const metadata = state.metadata as { preview?: string }

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
                    <FileIcon className="text-muted-foreground size-4" />
                    <span className="text-sm font-medium">{input.filePath}</span>
                  </div>
                  {(input.offset || input.limit) && (
                    <Badge variant="secondary" className="text-xs">
                      Lines {input.offset || 0}-{(input.offset || 0) + (input.limit || 2000)}
                    </Badge>
                  )}
                </div>
                {metadata?.preview && (
                  <ScrollArea className="h-[400px] w-full rounded-md border">
                    <pre className="p-4 font-mono text-xs">{metadata.preview}</pre>
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

export const renderWriteTool = (message: ToolPart) => {
  const state = message.state

  if (state.status === "completed") {
    const input = state.input as { filePath?: string; content?: string }
    const lines = (input.content || "").split("\n")
    const lineCount = lines.length

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
                    <FileTextIcon className="text-muted-foreground size-4" />
                    <span className="text-sm font-medium">{input.filePath}</span>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {lineCount} lines
                  </Badge>
                </div>
                <p className="text-muted-foreground text-sm">File written successfully</p>
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
