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

        // Prefer providers that work in local/test environments without external credentials.
        const pickPreferredProvider = () => {
          const priority = ["opencode", "openai", "anthropic"]
          for (const id of priority) {
            const match = formattedProviders.find((provider) => provider.id === id)
            if (match) return match
          }
          return formattedProviders[0]
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
          const defaultModelId = (data.default || {})[activeProviderId]
          const firstModel = modelsForActive[0]?.id
          const resolved = defaultModelId || firstModel || ""
          if (resolved) setSelectedModel(resolved)
        }

        if (!persistedProvider && !providerValid && formattedProviders.length > 0) {
          const fallback = pickPreferredProvider()
          if (fallback) {
            setSelectedProvider(fallback.id)
            const defaultModelId = defaultModels[fallback.id]
            const firstModel = fallback.models[0]?.id
            const resolved = defaultModelId || firstModel || ""
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
