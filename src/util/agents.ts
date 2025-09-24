import type { AgentInfo, AgentModelValue } from "@/lib/api/types"

const isModelObject = (value: unknown): value is Exclude<AgentModelValue, string | null> => {
  return (
    typeof value === "object" &&
    value !== null &&
    ("providerID" in (value as Record<string, unknown>) ||
      "modelID" in (value as Record<string, unknown>))
  )
}

export const getAgentModelValue = (agent: AgentInfo): AgentModelValue | undefined => {
  if (typeof agent !== "object" || agent === null) {
    return undefined
  }

  if (!("model" in agent)) {
    return undefined
  }

  const candidate = (agent as { model?: AgentModelValue }).model

  if (candidate === undefined) {
    return undefined
  }

  if (candidate === null || typeof candidate === "string" || isModelObject(candidate)) {
    return candidate
  }

  return undefined
}

export const formatAgentModelLabel = (agent: AgentInfo): string | null => {
  const value = getAgentModelValue(agent)
  if (!value) {
    return null
  }

  if (typeof value === "string") {
    return value
  }

  const providerID =
    typeof value.providerID === "string" && value.providerID.trim().length > 0
      ? value.providerID
      : undefined
  const modelID =
    typeof value.modelID === "string" && value.modelID.trim().length > 0 ? value.modelID : undefined

  if (providerID && modelID) {
    return `${providerID}/${modelID}`
  }

  return modelID ?? providerID ?? null
}
