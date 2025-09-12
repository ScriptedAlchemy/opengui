// Minimal stub for @opencode-ai/sdk/client for tests
export type OpencodeClient = any
export function createOpencodeClient(_opts?: any): any {
  return {
    project: {
      current: async () => ({ data: { id: "test-project", path: "/test/path" } }),
    },
    session: {
      list: async () => ({ data: [] }),
    },
    config: {
      get: async () => ({ data: {} }),
      providers: async () => ({ data: { providers: [], default: {} } }),
    },
  }
}
