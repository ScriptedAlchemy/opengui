// Minimal stub for @opencode-ai/sdk/client for tests
export type OpencodeClient = any
export function createOpencodeClient(_opts?: any): any {
  const providerPayload = {
    providers: [
      {
        id: "anthropic",
        name: "Anthropic",
        models: {
          "sonnet-4": { name: "Claude Sonnet 4" },
          "claude-3-5-sonnet": { name: "Claude 3.5 Sonnet" },
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
      anthropic: "sonnet-4",
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
