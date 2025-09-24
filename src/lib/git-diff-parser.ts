import type { DiffData, DiffChunk, DiffLine } from "@/types/diff"

const HUNK_HEADER_REGEX = /^@@\s+-([0-9]+)(?:,([0-9]+))?\s+\+([0-9]+)(?:,([0-9]+))?\s+@@/u

function parseHunkHeader(header: string) {
  const match = header.match(HUNK_HEADER_REGEX)
  if (!match) return null

  const [, oldStartRaw, oldCountRaw, newStartRaw, newCountRaw] = match
  const oldStart = Number.parseInt(oldStartRaw, 10)
  const newStart = Number.parseInt(newStartRaw, 10)
  const oldCount = oldCountRaw ? Number.parseInt(oldCountRaw, 10) : 1
  const newCount = newCountRaw ? Number.parseInt(newCountRaw, 10) : 1

  return {
    oldStart,
    newStart,
    oldCount,
    newCount,
  }
}

export function parseUnifiedDiff(diffText: string, filePath: string): DiffData | null {
  if (!diffText.trim()) {
    return {
      filePath,
      chunks: [],
    }
  }

  const lines = diffText.split(/\r?\n/u)
  const chunks: DiffChunk[] = []

  let currentChunk: DiffChunk | null = null
  let oldLinePointer = 0
  let newLinePointer = 0

  for (const line of lines) {
    if (
      line.startsWith("diff --git") ||
      line.startsWith("index ") ||
      line.startsWith("--- ") ||
      line.startsWith("+++ ")
    ) {
      continue
    }

    if (line.startsWith("@@")) {
      const hunkInfo = parseHunkHeader(line)
      if (!hunkInfo) {
        currentChunk = null
        continue
      }

      const { oldStart, newStart, oldCount, newCount } = hunkInfo

      currentChunk = {
        type: "context",
        oldStart,
        newStart,
        oldEnd: oldStart + Math.max(oldCount - 1, 0),
        newEnd: newStart + Math.max(newCount - 1, 0),
        lines: [],
      }
      chunks.push(currentChunk)

      oldLinePointer = oldStart
      newLinePointer = newStart
      continue
    }

    if (!currentChunk || !currentChunk.lines) continue

    if (line.startsWith("\\ No newline at end of file")) {
      currentChunk.lines.push({
        type: "unchanged",
        oldLine: null,
        newLine: null,
        content: "\\ No newline at end of file",
      })
      continue
    }

    const lineType = line[0]
    const content = line.slice(1)

    switch (lineType) {
      case "+": {
        const diffLine: DiffLine = {
          type: "added",
          oldLine: null,
          newLine: newLinePointer,
          content,
        }
        currentChunk.lines.push(diffLine)
        newLinePointer += 1
        break
      }
      case "-": {
        const diffLine: DiffLine = {
          type: "removed",
          oldLine: oldLinePointer,
          newLine: null,
          content,
        }
        currentChunk.lines.push(diffLine)
        oldLinePointer += 1
        break
      }
      case " ": {
        const diffLine: DiffLine = {
          type: "unchanged",
          oldLine: oldLinePointer,
          newLine: newLinePointer,
          content,
        }
        currentChunk.lines.push(diffLine)
        oldLinePointer += 1
        newLinePointer += 1
        break
      }
      default: {
        if (!line) {
          const diffLine: DiffLine = {
            type: "unchanged",
            oldLine: oldLinePointer,
            newLine: newLinePointer,
            content: "",
          }
          currentChunk.lines.push(diffLine)
          oldLinePointer += 1
          newLinePointer += 1
        }
        break
      }
    }
  }

  return {
    filePath,
    chunks,
  }
}
