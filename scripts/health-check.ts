/**
 * Health Check Script
 * 
 * Simple script to check if the server is running and healthy.
 */

export {}; // Make this file a module

const port = parseInt(process.env["PORT"] || "3099")
const hostname = process.env["HOST"] || "127.0.0.1"
const url = `http://${hostname}:${port}/health`

console.log(`🔍 Checking server health at ${url}...`)

try {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Accept": "application/json",
    },
  })

  if (!response.ok) {
    console.error(`❌ Health check failed: ${response.status} ${response.statusText}`)
    process.exit(1)
  }

  const data = await response.json()
  console.log("✅ Server is healthy!")
  console.log(`📊 Status: ${data.status}`)
  console.log(`⏰ Timestamp: ${data.timestamp}`)
  console.log(`📁 Projects: ${data.projects}`)

  process.exit(0)
} catch (error) {
  console.error(`❌ Health check failed: ${error}`)
  process.exit(1)
}
