// Minimal stub for @opencode-ai/sdk/client for tests
export type OpencodeClient = any
export function createOpencodeClient(_opts?: any): any {
  const providerPayload = {
    providers: [
      {
        id: "opencode",
        name: "OpenCode",
        models: {
          "claude-sonnet-4": { name: "Claude Sonnet 4" },
        },
      },
      {
        id: "openai",
        name: "OpenAI",
        models: {
          "gpt-5-nano": { name: "GPT-5 Nano" },
        },
      },
    ],
    default: {
      opencode: "claude-sonnet-4",
      openai: "gpt-5-nano",
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
