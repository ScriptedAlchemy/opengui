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

        // Validate persisted selection against freshly loaded providers/models
        const persistedProvider = selectedProvider
        const providerValid = formattedProviders.some((provider) => provider.id === persistedProvider)
        let nextProvider = persistedProvider
        if (!providerValid) {
          // Prefer anthropic if present, otherwise first provider
          nextProvider =
            formattedProviders.find((provider) => provider.id === "anthropic")?.id ||
            formattedProviders[0]?.id ||
            ""
          setSelectedProvider(nextProvider)
        }

        const modelsForNext = formattedProviders.find((provider) => provider.id === nextProvider)?.models ?? []
        const modelValid = modelsForNext.some((model) => model.id === selectedModel)
        if (!modelValid) {
          const defaultModelId = (data.default || {})[nextProvider]
          const firstModel = modelsForNext[0]?.id
          const resolved = defaultModelId || firstModel || ""
          if (resolved) setSelectedModel(resolved)
        }

        // Set default provider and model if not set (respect persisted value first)
        if (!selectedProvider && formattedProviders.length > 0) {
          // Try to use anthropic as default provider if available
          let defaultProvider = formattedProviders.find((p) => p.id === "anthropic")
          if (!defaultProvider) {
            defaultProvider = formattedProviders[0]
          }

          setSelectedProvider(defaultProvider.id)

          // Use the default model from API if available
          const defaultModelId = defaultModels[defaultProvider.id]
          if (!selectedModel) {
            if (defaultModelId) {
              setSelectedModel(defaultModelId)
            } else if (defaultProvider.models.length > 0) {
              setSelectedModel(defaultProvider.models[0].id)
            }
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
