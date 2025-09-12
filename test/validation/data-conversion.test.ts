import { describe, test, expect } from "@rstest/core"
/**
 * Data Type Conversion and Edge Cases Tests
 *
 * Tests data type conversions and edge cases:
 * - String to number conversions
 * - Boolean conversions
 * - Date/timestamp handling
 * - JSON parsing/serialization
 * - Null/undefined handling
 * - Array/object conversions
 */

// Mock data conversion utilities
const dataConverter = {
  stringToNumber: (value: string): number | null => {
    if (value == null) return null
    if (typeof value === "string" && value.trim() === "") return null
    const num = Number(value)
    return isNaN(num) ? null : num
  },

  stringToBoolean: (value: string): boolean => {
    if (typeof value !== "string") return false
    const lower = value.toLowerCase().trim()
    return lower === "true" || lower === "1" || lower === "yes" || lower === "on"
  },

  timestampToDate: (timestamp: number | string): Date | null => {
    if (timestamp == null) return null
    const num = typeof timestamp === "string" ? parseInt(timestamp, 10) : timestamp
    if (isNaN(num)) return null
    const date = new Date(num)
    return isNaN(date.getTime()) ? null : date
  },

  safeJsonParse: (json: string): any => {
    try {
      return JSON.parse(json)
    } catch {
      return null
    }
  },

  safeJsonStringify: (obj: any): string | null => {
    try {
      const out = JSON.stringify(obj)
      return typeof out === "string" ? out : null
    } catch {
      return null
    }
  },

  arrayToString: (arr: any[]): string => {
    if (!Array.isArray(arr)) return ""
    return arr.join(", ")
  },

  stringToArray: (str: string, delimiter = ","): string[] => {
    if (typeof str !== "string") return []
    return str
      .split(delimiter)
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0)
  },

  normalizeWhitespace: (str: string): string => {
    if (typeof str !== "string") return ""
    return str.replace(/\s+/g, " ").trim()
  },

  sanitizeFilename: (filename: string): string => {
    if (typeof filename !== "string") return ""
    return filename.replace(/[<>:"/\\|?*]/g, "_").replace(/\s+/g, "_")
  },
}

describe("Data Type Conversion and Edge Cases Tests", () => {
  describe("String to Number Conversion", () => {
    test("should convert valid number strings", () => {
      expect(dataConverter.stringToNumber("123")).toBe(123)
      expect(dataConverter.stringToNumber("123.45")).toBe(123.45)
      expect(dataConverter.stringToNumber("-456")).toBe(-456)
      expect(dataConverter.stringToNumber("0")).toBe(0)
      expect(dataConverter.stringToNumber("0.0")).toBe(0)
    })

    test("should handle scientific notation", () => {
      expect(dataConverter.stringToNumber("1e5")).toBe(100000)
      expect(dataConverter.stringToNumber("1.23e-4")).toBe(0.000123)
      expect(dataConverter.stringToNumber("1E10")).toBe(10000000000)
    })

    test("should return null for invalid strings", () => {
      expect(dataConverter.stringToNumber("abc")).toBe(null)
      expect(dataConverter.stringToNumber("123abc")).toBe(null)
      expect(dataConverter.stringToNumber("")).toBe(null)
      expect(dataConverter.stringToNumber("   ")).toBe(null)
    })

    test("should handle edge cases", () => {
      expect(dataConverter.stringToNumber("Infinity")).toBe(Infinity)
      expect(dataConverter.stringToNumber("-Infinity")).toBe(-Infinity)
      expect(dataConverter.stringToNumber("NaN")).toBe(null) // NaN is not a valid number
    })

    test("should handle null and undefined", () => {
      expect(dataConverter.stringToNumber(null as any)).toBe(null)
      expect(dataConverter.stringToNumber(undefined as any)).toBe(null)
    })
  })

  describe("String to Boolean Conversion", () => {
    test("should convert truthy strings", () => {
      expect(dataConverter.stringToBoolean("true")).toBe(true)
      expect(dataConverter.stringToBoolean("TRUE")).toBe(true)
      expect(dataConverter.stringToBoolean("True")).toBe(true)
      expect(dataConverter.stringToBoolean("1")).toBe(true)
      expect(dataConverter.stringToBoolean("yes")).toBe(true)
      expect(dataConverter.stringToBoolean("YES")).toBe(true)
      expect(dataConverter.stringToBoolean("on")).toBe(true)
      expect(dataConverter.stringToBoolean("ON")).toBe(true)
    })

    test("should convert falsy strings", () => {
      expect(dataConverter.stringToBoolean("false")).toBe(false)
      expect(dataConverter.stringToBoolean("FALSE")).toBe(false)
      expect(dataConverter.stringToBoolean("0")).toBe(false)
      expect(dataConverter.stringToBoolean("no")).toBe(false)
      expect(dataConverter.stringToBoolean("off")).toBe(false)
      expect(dataConverter.stringToBoolean("")).toBe(false)
    })

    test("should handle whitespace", () => {
      expect(dataConverter.stringToBoolean("  true  ")).toBe(true)
      expect(dataConverter.stringToBoolean("\ttrue\n")).toBe(true)
      expect(dataConverter.stringToBoolean("  false  ")).toBe(false)
    })

    test("should handle non-string inputs", () => {
      expect(dataConverter.stringToBoolean(null as any)).toBe(false)
      expect(dataConverter.stringToBoolean(undefined as any)).toBe(false)
      expect(dataConverter.stringToBoolean(123 as any)).toBe(false)
      expect(dataConverter.stringToBoolean([] as any)).toBe(false)
    })
  })

  describe("Timestamp to Date Conversion", () => {
    test("should convert valid timestamps", () => {
      const timestamp = 1640995200000 // 2022-01-01 00:00:00 UTC
      const date = dataConverter.timestampToDate(timestamp)
      expect(date).toBeInstanceOf(Date)
      expect(date?.getTime()).toBe(timestamp)
    })

    test("should convert string timestamps", () => {
      const timestamp = "1640995200000"
      const date = dataConverter.timestampToDate(timestamp)
      expect(date).toBeInstanceOf(Date)
      expect(date?.getTime()).toBe(1640995200000)
    })

    test("should handle invalid timestamps", () => {
      expect(dataConverter.timestampToDate("invalid")).toBe(null)
      expect(dataConverter.timestampToDate("")).toBe(null)
      expect(dataConverter.timestampToDate(NaN)).toBe(null)
    })

    test("should handle null and undefined", () => {
      expect(dataConverter.timestampToDate(null as any)).toBe(null)
      expect(dataConverter.timestampToDate(undefined as any)).toBe(null)
    })

    test("should handle edge timestamp values", () => {
      // Unix epoch
      const epoch = dataConverter.timestampToDate(0)
      expect(epoch?.getTime()).toBe(0)

      // Very large timestamp
      const future = dataConverter.timestampToDate(8640000000000000) // Max safe date
      expect(future).toBeInstanceOf(Date)

      // Negative timestamp
      const past = dataConverter.timestampToDate(-1)
      expect(past?.getTime()).toBe(-1)
    })
  })

  describe("JSON Parsing and Serialization", () => {
    test("should parse valid JSON", () => {
      expect(dataConverter.safeJsonParse('{"key": "value"}')).toEqual({ key: "value" })
      expect(dataConverter.safeJsonParse("[1, 2, 3]")).toEqual([1, 2, 3])
      expect(dataConverter.safeJsonParse('"string"')).toBe("string")
      expect(dataConverter.safeJsonParse("123")).toBe(123)
      expect(dataConverter.safeJsonParse("true")).toBe(true)
      expect(dataConverter.safeJsonParse("null")).toBe(null)
    })

    test("should return null for invalid JSON", () => {
      expect(dataConverter.safeJsonParse('{"invalid": json}')).toBe(null)
      expect(dataConverter.safeJsonParse("{")).toBe(null)
      expect(dataConverter.safeJsonParse("")).toBe(null)
      expect(dataConverter.safeJsonParse("undefined")).toBe(null)
    })

    test("should stringify valid objects", () => {
      expect(dataConverter.safeJsonStringify({ key: "value" })).toBe('{"key":"value"}')
      expect(dataConverter.safeJsonStringify([1, 2, 3])).toBe("[1,2,3]")
      expect(dataConverter.safeJsonStringify("string")).toBe('"string"')
      expect(dataConverter.safeJsonStringify(123)).toBe("123")
      expect(dataConverter.safeJsonStringify(true)).toBe("true")
      expect(dataConverter.safeJsonStringify(null)).toBe("null")
    })

    test("should handle circular references", () => {
      const circular: any = { a: 1 }
      circular.self = circular
      expect(dataConverter.safeJsonStringify(circular)).toBe(null)
    })

    test("should handle functions and undefined", () => {
      expect(dataConverter.safeJsonStringify(function () {})).toBe(null)
      expect(dataConverter.safeJsonStringify(undefined)).toBe(null)
      expect(dataConverter.safeJsonStringify(Symbol("test"))).toBe(null)
    })
  })

  describe("Array and String Conversions", () => {
    test("should convert arrays to strings", () => {
      expect(dataConverter.arrayToString(["a", "b", "c"])).toBe("a, b, c")
      expect(dataConverter.arrayToString([1, 2, 3])).toBe("1, 2, 3")
      expect(dataConverter.arrayToString([])).toBe("")
      expect(dataConverter.arrayToString(["single"])).toBe("single")
    })

    test("should handle non-array inputs", () => {
      expect(dataConverter.arrayToString("not-array" as any)).toBe("")
      expect(dataConverter.arrayToString(null as any)).toBe("")
      expect(dataConverter.arrayToString(undefined as any)).toBe("")
    })

    test("should convert strings to arrays", () => {
      expect(dataConverter.stringToArray("a,b,c")).toEqual(["a", "b", "c"])
      expect(dataConverter.stringToArray("a, b, c")).toEqual(["a", "b", "c"])
      expect(dataConverter.stringToArray("single")).toEqual(["single"])
      expect(dataConverter.stringToArray("")).toEqual([])
    })

    test("should handle custom delimiters", () => {
      expect(dataConverter.stringToArray("a|b|c", "|")).toEqual(["a", "b", "c"])
      expect(dataConverter.stringToArray("a;b;c", ";")).toEqual(["a", "b", "c"])
      expect(dataConverter.stringToArray("a b c", " ")).toEqual(["a", "b", "c"])
    })

    test("should filter empty values", () => {
      expect(dataConverter.stringToArray("a,,b,")).toEqual(["a", "b"])
      expect(dataConverter.stringToArray("a, , b, ")).toEqual(["a", "b"])
    })

    test("should handle non-string inputs", () => {
      expect(dataConverter.stringToArray(null as any)).toEqual([])
      expect(dataConverter.stringToArray(undefined as any)).toEqual([])
      expect(dataConverter.stringToArray(123 as any)).toEqual([])
    })
  })

  describe("String Normalization", () => {
    test("should normalize whitespace", () => {
      expect(dataConverter.normalizeWhitespace("  hello   world  ")).toBe("hello world")
      expect(dataConverter.normalizeWhitespace("hello\n\tworld")).toBe("hello world")
      expect(dataConverter.normalizeWhitespace("   ")).toBe("")
      expect(dataConverter.normalizeWhitespace("")).toBe("")
    })

    test("should handle non-string inputs", () => {
      expect(dataConverter.normalizeWhitespace(null as any)).toBe("")
      expect(dataConverter.normalizeWhitespace(undefined as any)).toBe("")
      expect(dataConverter.normalizeWhitespace(123 as any)).toBe("")
    })

    test("should sanitize filenames", () => {
      expect(dataConverter.sanitizeFilename("file<name>.txt")).toBe("file_name_.txt")
      expect(dataConverter.sanitizeFilename("file:name")).toBe("file_name")
      expect(dataConverter.sanitizeFilename("file name")).toBe("file_name")
      expect(dataConverter.sanitizeFilename("file/path\\name")).toBe("file_path_name")
    })

    test("should handle special filename cases", () => {
      expect(dataConverter.sanitizeFilename("")).toBe("")
      expect(dataConverter.sanitizeFilename("normal_filename.txt")).toBe("normal_filename.txt")
      expect(dataConverter.sanitizeFilename("file with   spaces")).toBe("file_with_spaces")
    })
  })

  describe("Null and Undefined Handling", () => {
    test("should handle null values consistently", () => {
      expect(dataConverter.stringToNumber(null as any)).toBe(null)
      expect(dataConverter.stringToBoolean(null as any)).toBe(false)
      expect(dataConverter.timestampToDate(null as any)).toBe(null)
      expect(dataConverter.arrayToString(null as any)).toBe("")
      expect(dataConverter.stringToArray(null as any)).toEqual([])
      expect(dataConverter.normalizeWhitespace(null as any)).toBe("")
    })

    test("should handle undefined values consistently", () => {
      expect(dataConverter.stringToNumber(undefined as any)).toBe(null)
      expect(dataConverter.stringToBoolean(undefined as any)).toBe(false)
      expect(dataConverter.timestampToDate(undefined as any)).toBe(null)
      expect(dataConverter.arrayToString(undefined as any)).toBe("")
      expect(dataConverter.stringToArray(undefined as any)).toEqual([])
      expect(dataConverter.normalizeWhitespace(undefined as any)).toBe("")
    })
  })

  describe("Edge Cases and Boundary Values", () => {
    test("should handle very large numbers", () => {
      const largeNumber = "9007199254740991" // Number.MAX_SAFE_INTEGER
      expect(dataConverter.stringToNumber(largeNumber)).toBe(9007199254740991)

      const tooLarge = "9007199254740992" // Beyond MAX_SAFE_INTEGER
      expect(dataConverter.stringToNumber(tooLarge)).toBe(9007199254740992)
    })

    test("should handle very small numbers", () => {
      const smallNumber = "5e-324" // Number.MIN_VALUE
      expect(dataConverter.stringToNumber(smallNumber)).toBe(5e-324)

      const zero =
        "0.0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001"
      expect(dataConverter.stringToNumber(zero)).toBe(0) // Underflow to 0
    })

    test("should handle very long strings", () => {
      const longString = "a".repeat(10000)
      expect(dataConverter.normalizeWhitespace(longString)).toBe(longString)
      expect(dataConverter.stringToArray(longString)).toEqual([longString])
    })

    test("should handle deeply nested objects", () => {
      const deepObject: any = {}
      let current = deepObject
      for (let i = 0; i < 100; i++) {
        current.nested = {}
        current = current.nested
      }

      const jsonString = dataConverter.safeJsonStringify(deepObject)
      expect(jsonString).toBeTruthy()

      if (jsonString) {
        const parsed = dataConverter.safeJsonParse(jsonString)
        expect(parsed).toBeTruthy()
      }
    })

    test("should handle arrays with mixed types", () => {
      const mixedArray = [1, "string", true, null, undefined, { key: "value" }]
      const result = dataConverter.arrayToString(mixedArray)
      expect(result).toBe("1, string, true, , , [object Object]")
    })

    test("should handle unicode and special characters", () => {
      const unicode = "Hello 世界 🌍 émojis"
      expect(dataConverter.normalizeWhitespace(unicode)).toBe(unicode)

      const jsonString = dataConverter.safeJsonStringify(unicode)
      expect(jsonString).toBeTruthy()

      if (jsonString) {
        const parsed = dataConverter.safeJsonParse(jsonString)
        expect(parsed).toBe(unicode)
      }
    })
  })

  describe("Type Coercion Edge Cases", () => {
    test("should handle JavaScript type coercion quirks", () => {
      // These are JavaScript's weird coercion behaviors
      expect(dataConverter.stringToNumber("")).toBe(null) // Our implementation returns null for empty string
      expect(dataConverter.stringToNumber("   ")).toBe(null) // Our implementation returns null for whitespace
      expect(dataConverter.stringToNumber("0x10")).toBe(16) // Hex numbers
      expect(dataConverter.stringToNumber("010")).toBe(10) // Not octal in our implementation
    })

    test("should handle boolean-like strings", () => {
      expect(dataConverter.stringToBoolean("0")).toBe(false)
      expect(dataConverter.stringToBoolean("1")).toBe(true)
      expect(dataConverter.stringToBoolean("2")).toBe(false) // Only "1" is truthy
      expect(dataConverter.stringToBoolean("false")).toBe(false)
      expect(dataConverter.stringToBoolean("true")).toBe(true)
    })

    test("should handle date edge cases", () => {
      // Invalid dates
      expect(dataConverter.timestampToDate(Infinity)).toBe(null)
      expect(dataConverter.timestampToDate(-Infinity)).toBe(null)

      // Edge of valid date range
      const maxDate = 8640000000000000
      const minDate = -8640000000000000
      expect(dataConverter.timestampToDate(maxDate)).toBeInstanceOf(Date)
      expect(dataConverter.timestampToDate(minDate)).toBeInstanceOf(Date)
    })
  })

  describe("Performance Edge Cases", () => {
    test("should handle large JSON objects efficiently", () => {
      const largeObject = {
        data: Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          name: `Item ${i}`,
          value: Math.random(),
        })),
      }

      const start = Date.now()
      const jsonString = dataConverter.safeJsonStringify(largeObject)
      const parseTime = Date.now() - start

      expect(jsonString).toBeTruthy()
      expect(parseTime).toBeLessThan(1000) // Should complete within 1 second

      if (jsonString) {
        const parsed = dataConverter.safeJsonParse(jsonString)
        expect(parsed.data).toHaveLength(1000)
      }
    })

    test("should handle large arrays efficiently", () => {
      const largeArray = Array.from({ length: 10000 }, (_, i) => `item-${i}`)

      const start = Date.now()
      const result = dataConverter.arrayToString(largeArray)
      const processTime = Date.now() - start

      expect(result).toContain("item-0")
      expect(result).toContain("item-9999")
      expect(processTime).toBeLessThan(1000) // Should complete within 1 second
    })
  })
})
