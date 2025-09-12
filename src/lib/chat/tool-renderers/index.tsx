import { ToolPart, ToolStateCompleted } from "@opencode-ai/sdk/client"
import { renderBashTool } from "./bash"
import { renderEditTool, renderReadTool, renderWriteTool } from "./file"
import { renderListTool, renderSearchTool } from "./search"
import { renderTaskTool, setRenderToolCallback } from "./task"
import { renderTodoTool } from "./todo"
import { renderWebFetchTool } from "./web"
import { renderDefaultTool } from "./default"

// Export the main renderer
export const renderTool = (message: ToolPart) => {
  switch (message.tool) {
    case "bash":
      return renderBashTool(message)
    case "edit":
      return renderEditTool(message)
    case "read":
      return renderReadTool(message)
    case "write":
      return renderWriteTool(message)
    case "ls":
    case "list":
      return renderListTool(message)
    case "glob":
    case "grep":
      return renderSearchTool(message)
    case "task":
      return renderTaskTool(message)
    case "todowrite":
    case "todoread":
      return renderTodoTool(message)
    case "webfetch":
    case "websearch":
      return renderWebFetchTool(message)
    default:
      return renderDefaultTool(message)
  }
}

// Set the callback to avoid circular dependency
setRenderToolCallback(renderTool)

// Main tool renderer function
export const renderSpecificTool = (toolName: string, state: ToolStateCompleted) => {
  const message: ToolPart = {
    id: "",
    sessionID: "",
    messageID: "",
    type: "tool",
    callID: "",
    tool: toolName,
    state,
  }

  return renderTool(message)
}
