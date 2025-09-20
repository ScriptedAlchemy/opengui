import { describe, test, expect } from "@rstest/core"
import {
  cn,
  formatBytes,
  formatDate,
  formatTime,
  formatDateTime,
  truncate,
  slugify,
  capitalize,
  formatRelativeTime,
} from "../src/lib/utils"

describe("Utility Functions", () => {
  describe("cn (className utility)", () => {
    test("combines class names correctly", () => {
      expect(cn("base", "additional")).toBe("base additional")
    })

    test("handles conditional classes", () => {
      expect(cn("base", true && "conditional", false && "hidden")).toBe("base conditional")
    })

    test("merges tailwind classes properly", () => {
      expect(cn("p-4", "p-2")).toBe("p-2")
      expect(cn("bg-red-500", "bg-blue-500")).toBe("bg-blue-500")
    })

    test("handles empty and undefined values", () => {
      expect(cn("base", "", undefined, null)).toBe("base")
    })
  })

  describe("formatBytes", () => {
    test("formats bytes correctly", () => {
      expect(formatBytes(0)).toBe("0 Byte")
      expect(formatBytes(1024)).toBe("1 KB")
      expect(formatBytes(1048576)).toBe("1 MB")
      expect(formatBytes(1073741824)).toBe("1 GB")
    })

    test("handles decimal places", () => {
      expect(formatBytes(1536, { decimals: 1 })).toBe("1.5 KB")
      expect(formatBytes(1536, { decimals: 2 })).toBe("1.50 KB")
    })

    test("uses accurate size type", () => {
      expect(formatBytes(1024, { sizeType: "accurate" })).toBe("1 KiB")
      expect(formatBytes(1048576, { sizeType: "accurate" })).toBe("1 MiB")
    })

    test("handles large numbers", () => {
      expect(formatBytes(1099511627776)).toBe("1 TB")
      expect(formatBytes(1099511627776, { sizeType: "accurate" })).toBe("1 TiB")
    })
  })

  describe("formatDate", () => {
    test("formats date from string", () => {
      // Use a UTC date string to avoid timezone issues
      const result = formatDate("2024-01-15T12:00:00Z")
      expect(result).toMatch(/January 1[45], 2024/)
    })

    test("formats date from timestamp", () => {
      // Use UTC to create consistent timestamp
      const timestamp = Date.UTC(2024, 0, 15, 12, 0, 0)
      const result = formatDate(timestamp)
      expect(result).toMatch(/January 1[45], 2024/)
    })

    test("formats date from Date object", () => {
      // Create date in UTC to avoid timezone issues
      const date = new Date(Date.UTC(2024, 0, 15, 12, 0, 0))
      const result = formatDate(date)
      expect(result).toMatch(/January 1[45], 2024/)
    })
  })

  describe("formatTime", () => {
    test("formats time correctly", () => {
      const date = new Date("2024-01-15T14:30:00")
      const result = formatTime(date)
      expect(result).toMatch(/2:30 PM|14:30/)
    })
  })

  describe("formatDateTime", () => {
    test("formats date and time together", () => {
      const date = new Date("2024-01-15T14:30:00")
      const result = formatDateTime(date)
      expect(result).toMatch(/Jan 15, 2024/)
      expect(result).toMatch(/2:30 PM|14:30/)
    })
  })

  describe("truncate", () => {
    test("truncates long strings", () => {
      expect(truncate("This is a long string", 10)).toBe("This is a ...")
    })

    test("leaves short strings unchanged", () => {
      expect(truncate("Short", 10)).toBe("Short")
    })

    test("handles exact length", () => {
      expect(truncate("Exactly10!", 10)).toBe("Exactly10!")
    })

    test("handles empty string", () => {
      expect(truncate("", 5)).toBe("")
    })
  })

  describe("slugify", () => {
    test("converts to lowercase", () => {
      expect(slugify("Hello World")).toBe("hello-world")
    })

    test("replaces spaces with hyphens", () => {
      expect(slugify("Multiple   Spaces")).toBe("multiple-spaces")
    })

    test("removes special characters", () => {
      expect(slugify("Hello! @#$ World?")).toBe("hello-world")
    })

    test("removes leading and trailing hyphens", () => {
      expect(slugify("  !Hello World!  ")).toBe("hello-world")
    })

    test("handles consecutive hyphens", () => {
      expect(slugify("Hello---World")).toBe("hello-world")
    })

    test("handles empty string", () => {
      expect(slugify("")).toBe("")
    })
  })

  describe("capitalize", () => {
    test("capitalizes first letter", () => {
      expect(capitalize("hello")).toBe("Hello")
    })

    test("leaves rest of string unchanged", () => {
      expect(capitalize("hELLO wORLD")).toBe("HELLO wORLD")
    })

    test("handles single character", () => {
      expect(capitalize("a")).toBe("A")
    })

    test("handles empty string", () => {
      expect(capitalize("")).toBe("")
    })
  })

  describe("formatRelativeTime", () => {
    const now = Date.now()

    test("shows 'Just now' for recent timestamps", () => {
      expect(formatRelativeTime(now - 30000)).toBe("Just now") // 30 seconds ago
    })

    test("shows minutes for recent times", () => {
      expect(formatRelativeTime(now - 300000)).toBe("5m ago") // 5 minutes ago
    })

    test("shows hours for times within a day", () => {
      expect(formatRelativeTime(now - 7200000)).toBe("2h ago") // 2 hours ago
    })

    test("shows days for times within a week", () => {
      expect(formatRelativeTime(now - 172800000)).toBe("2d ago") // 2 days ago
    })

    test("shows full date for older times", () => {
      const weekAgo = now - 604800000 // 7 days ago
      const result = formatRelativeTime(weekAgo)
      expect(result).toMatch(/\w+ \d+, \d{4}/) // Should be full date format
    })
  })
})
