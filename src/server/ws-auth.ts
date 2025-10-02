import { createHmac, randomBytes } from "node:crypto"

// Generate a secret at startup (in production, use env var)
const WS_SECRET = process.env.WS_SECRET || randomBytes(32).toString("hex")

export interface SessionToken {
  sessionId: string
  exp: number // expiration timestamp
}

export function generateSessionToken(sessionId: string): string {
  const exp = Date.now() + 60 * 60 * 1000 // 1 hour expiration
  const payload: SessionToken = { sessionId, exp }
  const payloadStr = JSON.stringify(payload)
  const payloadB64 = Buffer.from(payloadStr).toString("base64url")

  const signature = createHmac("sha256", WS_SECRET)
    .update(payloadB64)
    .digest("base64url")

  return `${payloadB64}.${signature}`
}

export function verifySessionToken(token: string): SessionToken | null {
  try {
    const [payloadB64, signature] = token.split(".")
    if (!payloadB64 || !signature) return null

    const expectedSignature = createHmac("sha256", WS_SECRET)
      .update(payloadB64)
      .digest("base64url")

    if (signature !== expectedSignature) return null

    const payloadStr = Buffer.from(payloadB64, "base64url").toString("utf8")
    const payload: SessionToken = JSON.parse(payloadStr)

    if (payload.exp < Date.now()) return null

    return payload
  } catch {
    return null
  }
}