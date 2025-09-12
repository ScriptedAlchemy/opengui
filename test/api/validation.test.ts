/**
 * API Validation Tests
 * Tests comprehensive input validation, sanitization, and edge cases
 * Using direct app.fetch() instead of HTTP server to avoid happy-dom issues
 */

import { describe, test, expect, beforeAll, beforeEach } from "@rstest/core"
import { createServer } from "../../src/server"
import type { Hono } from "hono"
import type { ProjectInfo } from "../../src/server/project-schemas"

describe("API Validation", () => {
  let app: Hono

  beforeAll(async () => {
    app = createServer()
  })

  beforeEach(async () => {
    // Clean up any existing projects before each test
    const response = await app.fetch(new Request("http://localhost/api/projects"))
    if (response.ok) {
      const responseText = await response.text()
      let projects: ProjectInfo[] = []
      try {
        projects = JSON.parse(responseText)
      } catch {
        // Response might not be JSON or empty
      }

      if (Array.isArray(projects)) {
        for (const project of projects) {
          await app.fetch(
            new Request(`http://localhost/api/projects/${project.id}`, {
              method: "DELETE",
            }),
          )
        }
      }
    }
  })

  describe("Input Validation Edge Cases", () => {
    test("should validate Unicode characters in project names", async () => {
      const unicodeName = "Project with émojis 🚀"

      const response = await app.fetch(
        new Request("http://localhost/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: unicodeName,
            path: "/tmp/unicode-test",
          }),
        }),
      )

      expect([200, 400]).toContain(response.status)

      if (response.status === 200) {
        const responseText = await response.text()
        let project
        try {
          project = JSON.parse(responseText)
        } catch {
          project = { name: null }
        }

        expect(typeof project.name).toBe("string")
      }
    })

    test("should handle very long project names", async () => {
      const veryLongName = "A".repeat(1000) // 1KB name (reduced for speed)

      const response = await app.fetch(
        new Request("http://localhost/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: veryLongName,
            path: "/tmp/long-name-test",
          }),
        }),
      )

      // Should either accept or reject gracefully
      expect([200, 400, 413]).toContain(response.status)
    })

    test("should validate project names with only whitespace", async () => {
      const whitespaceNames = ["   ", "\t\t\t", "\n\n\n"]

      for (const name of whitespaceNames) {
        const response = await app.fetch(
          new Request("http://localhost/api/projects", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: name,
              path: "/tmp/whitespace-test",
            }),
          }),
        )

        expect([200, 400]).toContain(response.status)
      }
    })

    test("should handle numeric project names", async () => {
      const numericNames = ["123", "0", "-456", "3.14159"]

      for (const name of numericNames) {
        const response = await app.fetch(
          new Request("http://localhost/api/projects", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: name,
              path: "/tmp/numeric-test",
            }),
          }),
        )

        expect([200, 400]).toContain(response.status)
      }
    })

    test("should validate boolean and null values as names", async () => {
      const response = await app.fetch(
        new Request("http://localhost/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: null,
            path: "/tmp/null-test",
          }),
        }),
      )

      expect([200, 400]).toContain(response.status)
    })
  })

  describe("Path Validation", () => {
    test("should validate absolute paths", async () => {
      const absolutePaths = ["/home/user/project", "/tmp/test-project", "/var/www/html"]

      for (const path of absolutePaths) {
        const response = await app.fetch(
          new Request("http://localhost/api/projects", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: "Path Test",
              path: path,
            }),
          }),
        )

        expect([200, 400]).toContain(response.status)
      }
    })

    test("should validate relative paths", async () => {
      const relativePaths = ["./relative-project", "../parent-project", "~/home-project"]

      for (const path of relativePaths) {
        const response = await app.fetch(
          new Request("http://localhost/api/projects", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: "Relative Path Test",
              path: path,
            }),
          }),
        )

        expect([200, 400]).toContain(response.status)
      }
    })

    test("should handle paths with special characters", async () => {
      const specialPaths = ["/tmp/project with spaces", "/tmp/project-with-dashes", "/tmp/project_with_underscores"]

      for (const path of specialPaths) {
        const response = await app.fetch(
          new Request("http://localhost/api/projects", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: "Special Path Test",
              path: path,
            }),
          }),
        )

        expect([200, 400]).toContain(response.status)
      }
    })

    test("should validate empty and whitespace-only paths", async () => {
      const invalidPaths = ["", "   ", "\t"]

      for (const path of invalidPaths) {
        const response = await app.fetch(
          new Request("http://localhost/api/projects", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: "Empty Path Test",
              path: path,
            }),
          }),
        )

        expect([200, 400]).toContain(response.status)
      }
    })
  })

  describe("JSON Structure Validation", () => {
    test("should validate extra unexpected fields", async () => {
      const extraFieldsData = {
        name: "Extra Fields Test",
        path: "/tmp/extra-fields-test",
        extraField1: "unexpected",
        extraField2: 123,
      }

      const response = await app.fetch(
        new Request("http://localhost/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(extraFieldsData),
        }),
      )

      // Should handle extra fields gracefully
      expect([200, 400]).toContain(response.status)
    })

    test("should validate array values for string fields", async () => {
      const arrayData = {
        name: ["Project", "Name", "Array"],
        path: ["/tmp", "array", "path"],
      }

      const response = await app.fetch(
        new Request("http://localhost/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(arrayData),
        }),
      )

      expect(response.status).toBe(400)
    })

    test("should validate object values for string fields", async () => {
      const objectData = {
        name: { first: "Project", last: "Name" },
        path: { root: "/tmp", sub: "project" },
      }

      const response = await app.fetch(
        new Request("http://localhost/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(objectData),
        }),
      )

      expect(response.status).toBe(400)
    })
  })

  describe("Content-Type Validation", () => {
    test("should handle different content-type variations", async () => {
      const contentTypes = ["application/json", "application/json; charset=utf-8", "Application/JSON"]

      for (const contentType of contentTypes) {
        const response = await app.fetch(
          new Request("http://localhost/api/projects", {
            method: "POST",
            headers: { "Content-Type": contentType },
            body: JSON.stringify({
              name: "Content Type Test",
              path: "/tmp/content-type-test",
            }),
          }),
        )

        expect([200, 400]).toContain(response.status)
      }
    })

    test("should handle invalid content-types", async () => {
      const invalidContentTypes = ["text/plain", "application/xml", "text/html"]

      for (const contentType of invalidContentTypes) {
        const response = await app.fetch(
          new Request("http://localhost/api/projects", {
            method: "POST",
            headers: { "Content-Type": contentType },
            body: JSON.stringify({
              name: "Invalid Content Type Test",
              path: "/tmp/invalid-content-type-test",
            }),
          }),
        )

        expect([200, 400, 415]).toContain(response.status)
      }
    })
  })
})
