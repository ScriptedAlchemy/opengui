// Minimal stub for @opencode-ai/sdk/client for tests
export type OpencodeClient = any
export function createOpencodeClient(_opts?: any): any {
  const providerPayload = {
    providers: [
      {
        id: "anthropic",
        name: "Anthropic",
        models: {
          "claude-sonnet-4-20250514": { name: "Claude Sonnet 4" },
          "claude-3-5-sonnet-20241022": { name: "Claude 3.5 Sonnet v2" },
        },
      },
      {
        id: "openai",
        name: "OpenAI",
        models: {
          "gpt-4o-mini": { name: "GPT-4o mini" },
        },
      },
    ],
    default: {
      anthropic: "claude-sonnet-4-20250514",
      openai: "gpt-4o-mini",
    },
  }

  return {
    project: {
      current: async () => ({ data: { id: "test-project", path: "/test/path" } }),
    },
    session: {
      list: async () => ({ data: [] }),
    },
    config: {
      get: async () => ({ data: {} }),
      providers: async () => ({ data: providerPayload }),
    },
  }
}
