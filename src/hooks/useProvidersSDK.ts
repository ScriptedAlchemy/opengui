import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import type { Provider } from "@/types/chat"
import { useProjectSDK } from "@/contexts/OpencodeSDKContext"

interface ProvidersResponsePayload {
  providers?: Array<{
    id: string
    name?: string
    models?: Record<string, { name?: string } | undefined>
  }>
  default?: Record<string, string | undefined>
}

export function useProvidersSDK(
  projectId: string | undefined,
  projectPath: string | undefined,
  instanceStatus: "running" | "stopped" | "starting"
) {
  const [providers, setProviders] = useState<Provider[]>([])
  // Persist selection per project in localStorage to keep chat input enabled
  const storageKey = projectId ? `opencode:providers:${projectId}` : undefined
  const initialSelection = (() => {
    try {
      if (!storageKey) return { provider: "", model: "" }
      const raw = localStorage.getItem(storageKey)
      if (!raw) return { provider: "", model: "" }
      const parsed = JSON.parse(raw) as { provider?: string; model?: string }
      return { provider: parsed.provider || "", model: parsed.model || "" }
    } catch {
      return { provider: "", model: "" }
    }
  })()

  const [selectedProvider, setSelectedProvider] = useState<string>(initialSelection.provider)
  const [selectedModel, setSelectedModel] = useState<string>(initialSelection.model)
  const { client, isLoading: sdkLoading } = useProjectSDK(projectId, projectPath)

  // Load providers and models from SDK
  useEffect(() => {
    if (!projectId || !projectPath || instanceStatus !== "running" || !client || sdkLoading) return

    const loadProviders = async () => {
      try {
        const response = await client.config.providers({
          query: { directory: projectPath },
        })

        // Handle SDK response structure
        if (!response.data) {
          console.error("No data in providers response")
          return
        }
        const data = response.data as ProvidersResponsePayload
        const providersArray = data.providers ?? []
        // Default models returned by backend (may be used as a fallback)
        const defaultModels = data.default ?? {}

        const formattedProviders: Provider[] = providersArray.map((provider) => {
          const modelsRecord = provider.models ?? {}
          const modelsArray = Object.entries(modelsRecord).map(([modelId, modelConfig]) => ({
            id: modelId,
            name: modelConfig?.name ?? modelId,
          }))

          return {
            id: provider.id,
            name: provider.name ?? provider.id,
            models: modelsArray,
          }
        })

        setProviders(formattedProviders)

        // Prefer Anthropic (Sonnet 4) by default, then OpenAI, then Opencode
        const pickPreferredProvider = () => {
          const priority = ["anthropic", "openai", "opencode"]
          for (const id of priority) {
            const match = formattedProviders.find((provider) => provider.id === id)
            if (match) return match
          }
          return formattedProviders[0]
        }

        const pickPreferredModel = (providerId: string) => {
          const provider = formattedProviders.find((p) => p.id === providerId)
          if (!provider) return ""
          const defaultModelId = (data.default || {})[providerId]
          const models = provider.models || []

          // Canonical Sonnet identifiers across vendors
          const sonnetPriority = [
            // Anthropic direct
            "claude-sonnet-4-20250514",
            "claude-3-7-sonnet-20250219",
            "claude-3-5-sonnet-20241022",
            "claude-3-5-sonnet-20240620",
            "claude-3-sonnet-20240229",
            // Common aliases across routers
            "claude-4-sonnet",
            "anthropic/claude-sonnet-4",
            "anthropic/claude-3.7-sonnet",
            // Vertex Anthropic
            "claude-sonnet-4@20250514",
            "claude-3-7-sonnet@20250219",
          ]

          // 1) Exact match by known IDs
          for (const id of sonnetPriority) {
            const hit = models.find((m) => m.id === id)
            if (hit) return hit.id
          }

          // 2) Regex match for Sonnet 4, then any Sonnet
          const sonnet4 = models.find(
            (m) => /(^|[^a-z])sonnet\s*[-_\s]*4([^0-9]|$)/i.test(m.id) || /(^|[^a-z])sonnet\s*[-_\s]*4([^0-9]|$)/i.test(m.name || "")
          )
          if (sonnet4) return sonnet4.id
          const anySonnet = models.find((m) => /(^|[^a-z])sonnet([^a-z]|$)/i.test(m.id) || /(^|[^a-z])sonnet([^a-z]|$)/i.test(m.name || ""))
          if (anySonnet) return anySonnet.id

          // 3) Backend default for provider
          if (defaultModelId && models.some((m) => m.id === defaultModelId)) return defaultModelId

          // 4) Fallback to first available
          return models[0]?.id || ""
        }

        const persistedProvider = selectedProvider
        const providerValid = formattedProviders.some((provider) => provider.id === persistedProvider)

        let activeProviderId = persistedProvider
        if (!providerValid) {
          const fallback = pickPreferredProvider()
          activeProviderId = fallback?.id ?? ""
          if (activeProviderId) setSelectedProvider(activeProviderId)
        }

        if (!activeProviderId && formattedProviders.length > 0) {
          const fallback = pickPreferredProvider()
          activeProviderId = fallback?.id ?? ""
          if (activeProviderId) setSelectedProvider(activeProviderId)
        }

        const modelsForActive =
          formattedProviders.find((provider) => provider.id === activeProviderId)?.models ?? []
        const modelValid = modelsForActive.some((model) => model.id === selectedModel)
        if (!modelValid) {
          const resolved = pickPreferredModel(activeProviderId)
          if (resolved) setSelectedModel(resolved)
        }

        if (!persistedProvider && !providerValid && formattedProviders.length > 0) {
          const fallback = pickPreferredProvider()
          if (fallback) {
            setSelectedProvider(fallback.id)
            // If backend suggests a default for this provider, allow it to win
            const backendDefault = defaultModels[fallback.id]
            const resolved = backendDefault || pickPreferredModel(fallback.id)
            if (resolved) setSelectedModel(resolved)
          }
        }
      } catch (error) {
        console.error("Failed to load providers:", error)
        // Do NOT fall back to hardcoded models - show error instead
        toast.error("Failed to load AI providers. Please check your configuration.")
      }
    }

    loadProviders()
  }, [
    projectId,
    projectPath,
    instanceStatus,
    client,
    sdkLoading,
    selectedProvider,
    selectedModel,
  ])

  // Persist selection when it changes
  useEffect(() => {
    try {
      if (!storageKey) return
      localStorage.setItem(
        storageKey,
        JSON.stringify({ provider: selectedProvider, model: selectedModel })
      )
    } catch {
      // ignore
    }
  }, [storageKey, selectedProvider, selectedModel])

  // Get available models for selected provider
  const availableModels = useMemo(() => {
    if (!selectedProvider || !providers.length) return []
    const provider = providers.find((p) => p.id === selectedProvider)
    return provider?.models || []
  }, [selectedProvider, providers])

  return {
    providers,
    selectedProvider,
    selectedModel,
    availableModels,
    setProviders,
    setSelectedProvider,
    setSelectedModel,
  }
}
