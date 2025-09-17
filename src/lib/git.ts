import type { OpencodeClient } from "@opencode-ai/sdk/client"

export interface GitSummary {
  branch: string
  changedFiles: number
  lastCommit?: {
    hash: string
    message: string
    author: string
    date: string
  }
}

type ShellClient = Pick<OpencodeClient, "session">

const GIT_STATUS_COMMAND = "git status --porcelain=v1 -b"
const GIT_LAST_COMMIT_COMMAND = "git log -1 --pretty=format:%H%x1f%an%x1f%ad%x1f%s --date=iso-strict"

export function extractTextFromMessage(message: unknown): string | undefined {
  if (!message || typeof message !== "object") {
    return undefined
  }

  const parts = (message as { parts?: unknown }).parts
  if (!Array.isArray(parts)) {
    return undefined
  }

  const textParts = parts
    .filter(
      (part): part is { type: "text"; text: string } =>
        part !== null &&
        typeof part === "object" &&
        (part as { type?: unknown }).type === "text" &&
        typeof (part as { text?: unknown }).text === "string"
    )
    .map((part) => part.text)

  if (textParts.length === 0) {
    return undefined
  }

  return textParts.join("")
}

export async function fetchGitSummary(
  client: ShellClient,
  directory: string
): Promise<GitSummary | null> {
  if (!directory) {
    return null
  }

  try {
    const statusResponse = await client.session.shell({
      path: { id: "git-status" },
      body: {
        command: GIT_STATUS_COMMAND,
        agent: "git",
      },
      query: { directory },
    })

    if (!("data" in statusResponse) || !statusResponse.data) {
      return null
    }

    const statusText = extractTextFromMessage(statusResponse.data)
    if (!statusText) {
      return null
    }

    const statusLines = statusText
      .split("\n")
      .map((line) => line.replace(/\r$/, ""))

    const branchLine = statusLines.find((line) => line.startsWith("##"))
    const fileLines = statusLines.filter((line) => line.trim() && !line.startsWith("##"))

    let branch = "main"
    if (branchLine) {
      const branchInfo = branchLine.replace(/^##\s*/, "")
      const [namePart] = branchInfo.split("...")
      const cleanName = namePart?.trim()
      if (cleanName) {
        branch = cleanName === "HEAD (no branch)" ? "HEAD" : cleanName
      }
    }

    const summary: GitSummary = {
      branch,
      changedFiles: fileLines.length,
    }

    const commitResponse = await client.session.shell({
      path: { id: "git-last-commit" },
      body: {
        command: GIT_LAST_COMMIT_COMMAND,
        agent: "git",
      },
      query: { directory },
    })

    if ("data" in commitResponse && commitResponse.data) {
      const commitText = extractTextFromMessage(commitResponse.data)?.trim()
      if (commitText) {
        const [hash, author, date, message] = commitText.split("\x1f")
        if (hash && author && date && message !== undefined) {
          summary.lastCommit = {
            hash,
            author,
            date,
            message,
          }
        }
      }
    }

    return summary
  } catch (error) {
    console.error("Failed to fetch git summary:", error)
    return null
  }
}
