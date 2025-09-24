/**
 * File utilities for handling file uploads and conversions
 */

export interface FileAttachment {
  id?: string
  type: "file"
  mime: string
  filename: string
  url: string // Data URI
  size: number
}

/**
 * Convert a File object to a data URI
 */
export const fileToDataUri = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error("Failed to read file"))
    reader.readAsDataURL(file)
  })
}

/**
 * Convert a File object to a FileAttachment with data URI
 */
export const fileToAttachment = async (file: File): Promise<FileAttachment> => {
  const dataUri = await fileToDataUri(file)

  return {
    type: "file",
    mime: file.type || "application/octet-stream",
    filename: file.name,
    url: dataUri,
    size: file.size,
  }
}

/**
 * Validate file size and type
 */
export const validateFile = (
  file: File,
  options?: {
    maxSize?: number // in bytes
    allowedTypes?: string[]
  }
): { valid: boolean; error?: string } => {
  const { maxSize = 10 * 1024 * 1024, allowedTypes } = options || {} // Default 10MB

  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File size (${formatFileSize(file.size)}) exceeds maximum allowed size (${formatFileSize(maxSize)})`,
    }
  }

  // If allowedTypes is provided, support wildcard patterns like "image/*" and "text/*".
  if (allowedTypes && allowedTypes.length > 0) {
    const fileType = file.type || "application/octet-stream"

    const matches = allowedTypes.some((pattern) => {
      if (!pattern) return false
      if (pattern === "*/*") return true
      // Wildcard major type, e.g. image/*
      if (pattern.endsWith("/*")) {
        const major = pattern.slice(0, -2)
        return fileType.startsWith(`${major}/`)
      }
      // Exact match
      return fileType === pattern
    })

    if (!matches) {
      return {
        valid: false,
        error: `File type "${fileType}" is not allowed. Allowed types: ${allowedTypes.join(", ")}`,
      }
    }
  }

  return { valid: true }
}

/**
 * Format file size in human readable format
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes"

  const k = 1024
  const sizes = ["Bytes", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}

/**
 * Get file icon based on mime type
 */
export const getFileIcon = (mimeType: string): string => {
  if (mimeType.startsWith("image/")) return "🖼️"
  if (mimeType.startsWith("video/")) return "🎥"
  if (mimeType.startsWith("audio/")) return "🎵"
  if (mimeType.includes("pdf")) return "📄"
  if (mimeType.includes("text/")) return "📝"
  if (
    mimeType.includes("json") ||
    mimeType.includes("javascript") ||
    mimeType.includes("typescript")
  )
    return "📋"
  if (mimeType.includes("zip") || mimeType.includes("archive")) return "📦"
  return "📎"
}

/**
 * Check if file is an image
 */
export const isImageFile = (mimeType: string): boolean => {
  return mimeType.startsWith("image/")
}

/**
 * Check if file is text-based
 */
export const isTextFile = (mimeType: string): boolean => {
  return (
    mimeType.startsWith("text/") ||
    mimeType.includes("json") ||
    mimeType.includes("javascript") ||
    mimeType.includes("typescript") ||
    mimeType.includes("xml")
  )
}
