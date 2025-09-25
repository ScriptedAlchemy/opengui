"use client"

import { useMemo, useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"

import type { DiffChunk, DiffData, DiffLine } from "@/types/diff"
import { cn } from "@/lib/utils"

function generateExpandedLines(
  chunk: DiffChunk,
  fullOldFile?: string[],
  fullNewFile?: string[]
): DiffLine[] {
  if (!fullOldFile || !fullNewFile) {
    const lines: DiffLine[] = []
    const lineCount = chunk.hiddenLines ?? 10

    if (chunk.expandDirection === "up") {
      for (let i = lineCount; i > 0; i -= 1) {
        lines.push({
          type: "unchanged",
          oldLine: chunk.oldStart - i,
          newLine: chunk.newStart - i,
          content: `  // ... line ${chunk.oldStart - i} ...`,
        })
      }
    } else {
      const startOld = (chunk.oldEnd ?? chunk.oldStart) + 1
      const startNew = (chunk.newEnd ?? chunk.newStart) + 1

      for (let i = 0; i < lineCount; i += 1) {
        lines.push({
          type: "unchanged",
          oldLine: startOld + i,
          newLine: startNew + i,
          content: `  // ... line ${startOld + i} ...`,
        })
      }
    }

    return lines
  }

  const lines: DiffLine[] = []

  if (chunk.expandDirection === "up") {
    const startLine = Math.max(0, chunk.oldStart - (chunk.hiddenLines ?? 10) - 1)
    const endLine = chunk.oldStart - 1

    for (let i = startLine; i < endLine; i += 1) {
      lines.push({
        type: "unchanged",
        oldLine: i + 1,
        newLine: i + 1,
        content: fullOldFile[i] ?? `  // line ${i + 1}`,
      })
    }
  } else {
    const startOld = chunk.oldEnd ?? chunk.oldStart
    const startNew = chunk.newEnd ?? chunk.newStart
    const lineCount = chunk.hiddenLines ?? 10

    for (let i = 0; i < lineCount; i += 1) {
      lines.push({
        type: "unchanged",
        oldLine: startOld + i + 1,
        newLine: startNew + i + 1,
        content: fullOldFile[startOld + i] ?? `  // line ${startOld + i + 1}`,
      })
    }
  }

  return lines
}

function useLineNumberWidth(
  diff: DiffData | null | undefined,
  expandedChunks: Set<number>
): number {
  return useMemo(() => {
    if (!diff) return 3

    let maxLineNumber = 0

    diff.chunks.forEach((chunk, chunkIndex) => {
      if (chunk.lines) {
        chunk.lines.forEach((line) => {
          maxLineNumber = Math.max(maxLineNumber, line.oldLine ?? 0, line.newLine ?? 0)
        })
      }

      if (chunk.type === "expand" && expandedChunks.has(chunkIndex)) {
        if (chunk.expandDirection === "up") {
          maxLineNumber = Math.max(maxLineNumber, chunk.oldStart, chunk.newStart)
        } else {
          const endOld = (chunk.oldEnd ?? chunk.oldStart) + (chunk.hiddenLines ?? 10)
          const endNew = (chunk.newEnd ?? chunk.newStart) + (chunk.hiddenLines ?? 10)
          maxLineNumber = Math.max(maxLineNumber, endOld, endNew)
        }
      }
    })

    return Math.max(3, maxLineNumber.toString().length)
  }, [diff, expandedChunks])
}

export interface DiffPreviewProps {
  diff: DiffData | null | undefined
  rawDiff?: string
  className?: string
}

export function DiffPreview({ diff, rawDiff, className }: DiffPreviewProps) {
  const [expandedChunks, setExpandedChunks] = useState<Set<number>>(new Set())
  const lineNumberWidth = useLineNumberWidth(diff, expandedChunks)

  const toggleChunk = (index: number) => {
    setExpandedChunks((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  if (!diff || diff.chunks.length === 0) {
    if (rawDiff) {
      return (
        <pre
          className={cn(
            "border-border bg-input/30 rounded-md border p-4 font-mono text-xs whitespace-pre-wrap",
            className
          )}
        >
          {rawDiff}
        </pre>
      )
    }

    return (
      <div
        className={cn(
          "border-border bg-input/30 text-muted-foreground rounded-md border p-4 text-xs",
          className
        )}
      >
        No diff available.
      </div>
    )
  }

  return (
    <div
      className={cn(
        "border-border bg-card text-foreground rounded-md border text-xs",
        "overflow-hidden font-mono",
        className
      )}
    >
      <div className="divide-border/50 divide-y">
        {diff.chunks.map((chunk, chunkIndex) => (
          <div key={`${chunk.type}-${chunkIndex}`}>
            {chunk.type === "expand" ? (
              <div>
                {expandedChunks.has(chunkIndex) ? (
                  <div>
                    {generateExpandedLines(chunk, diff.fullOldFile, diff.fullNewFile).map(
                      (line, lineIndex) => (
                        <div key={`expanded-${chunkIndex}-${lineIndex}`} className="flex">
                          <div className="bg-muted/60 border-border/70 flex border-r">
                            <div
                              className="text-muted-foreground px-2 py-1 text-right select-none"
                              style={{ width: `${lineNumberWidth + 1}ch` }}
                            >
                              {line.oldLine ?? ""}
                            </div>
                            <div
                              className="text-muted-foreground px-2 py-1 text-right select-none"
                              style={{ width: `${lineNumberWidth + 1}ch` }}
                            >
                              {line.newLine ?? ""}
                            </div>
                          </div>
                          <div className="w-6" />
                          <div className="flex-1 overflow-x-auto px-2 py-1 whitespace-pre">
                            {line.content}
                          </div>
                        </div>
                      )
                    )}

                    <button
                      type="button"
                      onClick={() => toggleChunk(chunkIndex)}
                      className="border-border/60 bg-muted/70 text-muted-foreground hover:bg-muted flex w-full items-center gap-2 border-t px-3 py-1 text-left text-[11px] transition"
                    >
                      <ChevronUp size={14} />
                      Collapse
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => toggleChunk(chunkIndex)}
                    className="border-border/60 bg-muted/70 text-muted-foreground hover:bg-muted flex w-full items-center gap-2 border-t px-3 py-1 text-left text-[11px] transition"
                  >
                    {chunk.expandDirection === "up" ? (
                      <ChevronUp size={14} />
                    ) : (
                      <ChevronDown size={14} />
                    )}
                    {chunk.expandDirection === "up" ? "Expand Up" : "Expand Down"}
                    {chunk.hiddenLines ? (
                      <span className="text-muted-foreground/70 ml-auto">
                        {chunk.hiddenLines} hidden lines
                      </span>
                    ) : null}
                  </button>
                )}
              </div>
            ) : (
              <div>
                <div className="bg-muted/70 text-muted-foreground px-3 py-1 text-[11px]">
                  @@ -{chunk.oldStart},{chunk.lines?.filter((l) => l.type !== "added").length ?? 0}{" "}
                  +{chunk.newStart},{chunk.lines?.filter((l) => l.type !== "removed").length ?? 0}{" "}
                  @@
                </div>

                {chunk.lines?.map((line, lineIndex) => {
                  const baseLineClass =
                    line.type === "added"
                      ? "bg-emerald-500/10"
                      : line.type === "removed"
                        ? "bg-rose-500/10"
                        : "bg-transparent"

                  const gutterClass =
                    line.type === "added"
                      ? "bg-emerald-500/10"
                      : line.type === "removed"
                        ? "bg-rose-500/10"
                        : "bg-muted/60"

                  const indicatorClass =
                    line.type === "added"
                      ? "text-emerald-400"
                      : line.type === "removed"
                        ? "text-rose-400"
                        : "text-transparent"

                  return (
                    <div
                      key={`line-${chunkIndex}-${lineIndex}`}
                      className={cn("flex", baseLineClass)}
                    >
                      <div className={cn("border-border/70 flex border-r", gutterClass)}>
                        <div
                          className="text-muted-foreground px-2 py-1 text-right select-none"
                          style={{ width: `${lineNumberWidth + 1}ch` }}
                        >
                          {line.oldLine ?? ""}
                        </div>
                        <div
                          className="text-muted-foreground px-2 py-1 text-right select-none"
                          style={{ width: `${lineNumberWidth + 1}ch` }}
                        >
                          {line.newLine ?? ""}
                        </div>
                      </div>
                      <div
                        className={cn(
                          "flex w-6 items-center justify-center text-[11px] font-semibold",
                          indicatorClass
                        )}
                      >
                        {line.type === "added" ? "+" : line.type === "removed" ? "-" : ""}
                      </div>
                      <div className="flex-1 overflow-x-auto px-2 py-1 whitespace-pre">
                        {line.content}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default DiffPreview
