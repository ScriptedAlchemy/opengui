export type DiffLineType = "unchanged" | "added" | "removed"

export interface DiffLine {
  type: DiffLineType
  oldLine: number | null
  newLine: number | null
  content: string
}

export type DiffChunkType = "context" | "expand"

export interface DiffChunk {
  type: DiffChunkType
  oldStart: number
  newStart: number
  oldEnd?: number
  newEnd?: number
  lines?: DiffLine[]
  expandDirection?: "up" | "down"
  hiddenLines?: number
}

export interface DiffData {
  filePath: string
  chunks: DiffChunk[]
  fullOldFile?: string[]
  fullNewFile?: string[]
}
