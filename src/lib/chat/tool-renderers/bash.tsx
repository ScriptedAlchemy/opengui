import { ScrollArea } from "@/components/ui/scroll-area"
import { CodeBlock, CodeBlockBody, CodeBlockContent } from "@/components/ui/shadcn-io/code-block"
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ui/shadcn-io/ai/tool"
import { ToolPart } from "@opencode-ai/sdk/client"
import { renderDefaultTool } from "./default"

export const renderBashTool = (message: ToolPart) => {
  const state = message.state

  if (state.status === "completed") {
    const input = state.input as { command?: string }
    const metadata = state.metadata as { output?: string; exitCode?: number }

    const output = metadata?.output || ""
    const truncated = output.length > 2000
    const displayOutput = truncated ? output.slice(0, 2000) + "\n... (output truncated)" : output

    return (
      <Tool defaultOpen={false}>
        <ToolHeader type={message.tool} state={state} />
        <ToolContent>
          <ToolInput input={input} />
          <ToolOutput
            output={
              <div className="space-y-3">
                {input.command && (
                  <div className="space-y-2">
                    <h4 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                      Command
                    </h4>
                    <CodeBlock
                      data={[
                        {
                          language: "bash",
                          filename: "",
                          code: input.command,
                        },
                      ]}
                    >
                      <CodeBlockBody>
                        {(item) => (
                          <CodeBlockContent key={item.filename} language={item.language}>
                            {item.code}
                          </CodeBlockContent>
                        )}
                      </CodeBlockBody>
                    </CodeBlock>
                  </div>
                )}
                {displayOutput && (
                  <div className="space-y-2">
                    <h4 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                      Output{" "}
                      {metadata?.exitCode !== undefined && `(Exit Code: ${metadata.exitCode})`}
                    </h4>
                    <ScrollArea className="bg-muted/30 h-[300px] w-full rounded-md border">
                      <pre className="p-4 font-mono text-xs whitespace-pre-wrap">
                        {displayOutput}
                      </pre>
                    </ScrollArea>
                  </div>
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
