import { useEffect, useState } from "react"
import { toast } from "sonner"
import type { ProjectInfo } from "@/server/project-manager"
import { useProjectSDK as useSDKClient } from "@/contexts/OpencodeSDKContext"
import type { Project as SDKProject } from "@opencode-ai/sdk/client"

export function useProjectSDK(projectId: string | undefined, projectPath: string | undefined) {
  const [project, setProject] = useState<ProjectInfo | null>(null)
  const [instanceStatus, setInstanceStatus] = useState<"running" | "stopped" | "starting">(
    "stopped"
  )
  const { client, isLoading } = useSDKClient(projectId, projectPath)

  // Load project info using SDK and API
  useEffect(() => {
    if (!projectId) return

    const loadProject = async () => {
      // First try to get project info from API (has more complete data)
      try {
        const apiResponse = await fetch(`/api/projects`)
        if (!apiResponse.ok) {
          // Enhanced error logging for HTTP failures
          const responseClone = apiResponse.clone()
          const responseText = await responseClone.text().catch(() => "Unable to read response body")
          const responseHeaders = Object.fromEntries(apiResponse.headers.entries())
          console.error('Failed to fetch projects:', {
            method: 'GET',
            url: '/api/projects',
            status: apiResponse.status,
            statusText: apiResponse.statusText,
            headers: responseHeaders,
            body: responseText
          })
          // Do not throw in UI hook; proceed with SDK fallback
          return
        }

        const projectsJson = (await apiResponse.json()) as unknown
        if (Array.isArray(projectsJson)) {
          const projectData = projectsJson.find(
            (proj): proj is ProjectInfo =>
              typeof proj === "object" &&
              proj !== null &&
              "id" in proj &&
              typeof (proj as { id?: unknown }).id === "string"
          )
          if (projectData) {
            setProject(projectData)
          }
        }
      } catch (error) {
        console.error("Failed to load project from API:", error)
        toast.error("Failed to load project")
      }

      // If SDK client is available, verify connection
      if (client && projectPath) {
        try {
          const response = await client.project.list()

          if (response.data) {
            // Find matching project in SDK response
            const sdkProject = response.data.find((p: SDKProject) => p.id === projectId)
            if (sdkProject) {
              console.log("SDK project found:", sdkProject)
              setInstanceStatus("running") // SDK connection implies running instance
            }
          }
        } catch (error) {
          console.error("Failed to verify project via SDK:", error)
        }
      }
    }

    loadProject()
  }, [projectId, projectPath, client])

  // Check instance status using SDK
  useEffect(() => {
    if (!projectId || !projectPath || !client) return

    // If we have a client, instance is running
    if (client) {
      setInstanceStatus("running")

      // Initialize app context when SDK is ready
      const initApp = async () => {
        try {
          // Try to get current project info to verify connection
          const currentResponse = await client.project.current({
            query: { directory: projectPath },
          })

          if (currentResponse.data) {
            console.log("SDK connection verified, project:", currentResponse.data)
          }
        } catch (error) {
          console.warn("Failed to verify SDK connection:", error)
        }
      }

      initApp()
    }
  }, [projectId, projectPath, client])

  return {
    project,
    instanceStatus,
    setProject,
    setInstanceStatus,
    isLoading,
    client,
  }
}
