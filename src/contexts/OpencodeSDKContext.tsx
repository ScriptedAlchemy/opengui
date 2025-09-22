/**
 * OpenCode SDK Context Provider
 *
 * Provides SDK client instances to React components, managing the lifecycle
 * of OpenCode servers and SDK connections per project.
 */

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from "react"
import type { OpencodeClient } from "@opencode-ai/sdk/client"
import { opencodeSDKService } from "@/services/opencode-sdk-service"

interface OpencodeSDKContextValue {
  getClient: (projectId: string, projectPath: string) => Promise<OpencodeClient>
  currentClient: OpencodeClient | null
  isLoading: boolean
  error: Error | null
}

const OpencodeSDKContext = createContext<OpencodeSDKContextValue | null>(null)

export function useOpencodeSDK() {
  const context = useContext(OpencodeSDKContext)
  if (!context) {
    throw new Error("useOpencodeSDK must be used within OpencodeSDKProvider")
  }
  return context
}

interface OpencodeSDKProviderProps {
  children: React.ReactNode
}

export function OpencodeSDKProvider({ children }: OpencodeSDKProviderProps) {
  const [currentClient, setCurrentClient] = useState<OpencodeClient | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const clientCacheRef = useRef<Map<string, OpencodeClient>>(new Map())

  const getClient = useCallback(async (projectId: string, projectPath: string): Promise<OpencodeClient> => {
    // Check cache first
    const cached = clientCacheRef.current.get(projectId)
    if (cached) {
      setCurrentClient(cached)
      return cached
    }

    setIsLoading(true)
    setError(null)

    try {
      const client = await opencodeSDKService.getClient(projectId, projectPath)
      clientCacheRef.current.set(projectId, client)
      setCurrentClient(client)
      return client
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to create SDK client")
      setError(error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      opencodeSDKService.stopAll()
    }
  }, [])

  const value: OpencodeSDKContextValue = {
    getClient,
    currentClient,
    isLoading,
    error,
  }

  return <OpencodeSDKContext.Provider value={value}>{children}</OpencodeSDKContext.Provider>
}

// Hook for using SDK with current project
export function useProjectSDK(projectId: string | undefined, projectPath: string | undefined) {
  const { getClient, isLoading, error } = useOpencodeSDK()
  const [client, setClient] = useState<OpencodeClient | null>(null)
  const [loading, setLoading] = useState(false)
  const attemptedRef = useRef(false)
  const inFlightRef = useRef(false)
  const lastRequestKeyRef = useRef<string | null>(null)

  useEffect(() => {
    const requestKey = projectId ? `${projectId}:${projectPath ?? ""}` : null
    if (requestKey !== lastRequestKeyRef.current) {
      attemptedRef.current = false
    }
    lastRequestKeyRef.current = requestKey

    if (!projectId) {
      setClient(null)
      attemptedRef.current = false
      inFlightRef.current = false
      return
    }

    if (inFlightRef.current) {
      return
    }

    // Prevent infinite retries if already attempted and failed
    if (attemptedRef.current && error) {
      console.warn('Skipping SDK client creation due to previous error:', error)
      return
    }

    setLoading(true)
    attemptedRef.current = true
    inFlightRef.current = true
    
    // Create SDK client as soon as we have a projectId; projectPath is not required for client construction
    getClient(projectId, projectPath || "")
      .then(setClient)
      .catch((err) => {
        console.error('Failed to get SDK client:', err)
        setClient(null)
      })
      .finally(() => {
        setLoading(false)
        inFlightRef.current = false
      })
  }, [projectId, projectPath, getClient, error])

  return {
    client,
    isLoading: loading || isLoading,
    error,
  }
}
