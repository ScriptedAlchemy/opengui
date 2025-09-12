// Minimal stub for @opencode-ai/sdk for tests
export type Session = any
export type Part = any
export type OpencodeClient = any
export const sdkVersion = "test"
export async function createOpencodeServer(_opts?: any): Promise<{ url: string; close: () => void }> {
  return { url: "http://127.0.0.1:0", close: () => {} }
}
