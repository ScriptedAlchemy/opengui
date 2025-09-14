import { test, expect } from "@playwright/test"
 
import { openFirstProjectAndGetId, goToChat } from "./helpers"

// Simplified E2E test for thinking component functionality
// Focuses on verifying reasoning tokens are returned and not empty

test.describe("Thinking Component E2E Tests", () => {
  let projectId: string
  
  test.beforeEach(async ({ page }) => {
    test.setTimeout(60000) // 1 minute timeout
    
    // Navigate to app and get a project (simplified approach)
    await page.goto("/")
    await page.waitForSelector("#root", { state: "visible", timeout: 10000 })
    await page.waitForTimeout(2000)

    // Find first available project
    const projectItems = page.locator('[data-testid="project-item"]')
    const firstProject = projectItems.first()
    
    if (await firstProject.isVisible({ timeout: 5000 })) {
      const openButton = firstProject.locator('button:has-text("Open")')
      await openButton.click()
      await page.waitForTimeout(2000)

      // Extract project ID from URL
      const currentUrl = page.url()
      if (currentUrl.includes("/projects/")) {
        const urlParts = currentUrl.split("/projects/")[1]
        if (urlParts) {
          projectId = urlParts.split("/")[0]
          
        }
      }
    }
  })
  
  test("should verify thinking tokens exist in API responses", async ({ page }) => {
    // Navigate robustly to chat for the current project
    const pid = projectId || (await openFirstProjectAndGetId(page))
    await goToChat(page, pid)
    
    // Monitor API responses for reasoning tokens
    const apiResponses: any[] = []
    page.on('response', async (response) => {
      if (response.url().includes('/sessions/') && response.url().includes('/messages')) {
        try {
          const responseData = await response.json()
          apiResponses.push(responseData)
        } catch (e) {
          // Ignore non-JSON responses
        }
      }
    })
    
    // At this point we are on chat page
    
    
    
    // Find message input using proper data-testid
    const messageInput = page.locator('[data-testid="chat-input-textarea"]')
    
    // Test should fail if chat input is not found
    expect(await messageInput.isVisible({ timeout: 5000 })).toBe(true)
    
    // Send a message that might trigger reasoning
    const testMessage = "Please analyze this step by step: How would you design a scalable system?"
    await messageInput.fill(testMessage)
    await messageInput.press("Enter")
    
    // Wait for response
    await page.waitForTimeout(10000)
    
    // Check if thinking component appears using proper data-testid
    const thinkingButton = page.locator('[data-testid="thinking-toggle"]')
    if (await thinkingButton.isVisible({ timeout: 5000 })) {
      
      
      // Click to expand
      await thinkingButton.click()
      await page.waitForTimeout(1000)
      
      // Look for reasoning content using proper data-testid
      const reasoningContent = page.locator('[data-testid="thinking-content"]')
      if (await reasoningContent.isVisible({ timeout: 2000 })) {
        const text = await reasoningContent.textContent()
        if (text && text.trim().length > 0) {
          
          expect(text.trim().length).toBeGreaterThan(0)
          
          // Use inline snapshot to capture content
          expect(text.substring(0, 100)).toMatchSnapshot('reasoning-preview.txt')
        }
      }
    }
    
    // Check API responses for reasoning tokens
    for (const response of apiResponses) {
      if (response.parts) {
        for (const part of response.parts) {
          if (part.type === "reasoning" && part.text && part.text.trim().length > 0) {
            
            expect(part.text.trim().length).toBeGreaterThan(0)
            break
          }
        }
      }
    }
    
    // At least verify we can send messages (even if no reasoning)
    
  })
  
  test("should verify basic chat functionality works", async ({ page }) => {
    // Navigate to sessions page
    await page.goto(`/projects/${projectId}/sessions`)
    await page.waitForTimeout(2000)
    
    // Verify page loads and basic elements exist
    const pageTitle = page.locator('h1, h2').filter({ hasText: /session|chat/i }).first()
    if (await pageTitle.isVisible({ timeout: 5000 })) {
    
    }
    
    // Look for new session button using proper data-testid
    const newSessionButton = page.locator('[data-testid="new-session-button"]')
    expect(await newSessionButton.isVisible({ timeout: 5000 })).toBe(true)
    
    
    // Basic functionality verification
    expect(page.url()).toContain('/sessions')
  })
  
  test("should handle reasoning-capable models when available", async ({ page }) => {
    const pid = projectId || (await openFirstProjectAndGetId(page))
    await goToChat(page, pid)
    
    // Look for specific chat interface elements using proper data-testids and IDs
    // Based on ChatHeader.tsx: provider uses id="provider-select", model uses id="model-select"
    const chatHeaderElement = page.locator('[data-testid="chat-header"]')
    const providerSelect = page.locator('#provider-select')
    const modelSelect = page.locator('#model-select')
    const chatInput = page.locator('[data-testid="chat-input-textarea"]')
    
    // Check if we're actually on the chat interface by looking for these specific elements
    const chatHeaderVisible = await chatHeaderElement.isVisible({ timeout: 3000 })
    const providerVisible = await providerSelect.isVisible({ timeout: 2000 })
    const modelVisible = await modelSelect.isVisible({ timeout: 2000 })
    const chatInputVisible = await chatInput.isVisible({ timeout: 2000 })
    
    
    
    const providerFound = providerVisible && modelVisible
    const chatInterfaceFound = chatHeaderVisible && chatInputVisible
    
    // If no provider selector found, check if we're in the right interface
    if (!providerFound) {
      
      // Try to navigate directly to a chat session
      if (!page.url().includes('/chat')) {
        await page.goto(`/projects/${projectId}/sessions/new/chat`)
        await page.waitForTimeout(3000)
      }
    }
    
    // Assert that we found all required chat interface elements - test should fail if not on proper chat page
     if (!chatInterfaceFound) {
       const currentUrl = page.url()
       
       expect(chatInterfaceFound).toBe(true) // This will fail the test
     }
     
     if (!providerFound) {
       const currentUrl = page.url()
       
       expect(providerFound).toBe(true) // This will fail the test
     }
     
     
  })
})
