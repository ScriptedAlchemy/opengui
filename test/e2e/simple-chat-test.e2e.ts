/**
 * Simple E2E test to verify chat messages appear in the UI
 */

import { test, expect } from "@playwright/test"
import { openFirstProjectAndGetId, goToChat } from "./helpers"

test.describe("Simple Chat Test", () => {
  test("should send message and verify it appears in UI", async ({ page }) => {
    console.log("Starting test: should send message and verify it appears in UI")
    
    // Set up API error tracking
    const apiErrors: Array<{url: string, status: number, method: string}> = []
    
    // Monitor API responses for errors
    page.on("response", (response) => {
      if (response.url().includes("/session") || response.url().includes("/message")) {
        // Only log non-200 responses to reduce noise
        if (response.status() !== 200) {
          console.log(`🔍 SDK response: ${response.status()} ${response.url()}`)
        }
        
        if (response.status() >= 400) {
          const method = response.request().method()
          apiErrors.push({
            url: response.url(),
            status: response.status(),
            method: method
          })
          console.log(`❌ API Error: ${method} ${response.url()} returned ${response.status()}`)
        }
      }
    })

    const projectId = await openFirstProjectAndGetId(page)
    await goToChat(page, projectId)
    
    // Additional wait for chat interface to fully load
    await page.waitForTimeout(5000)
    
    // Wait specifically for the chat input to be available
    await page.waitForSelector('[data-testid="chat-input-textarea"]', { 
      state: 'visible',
      timeout: 15000 
    })

    // Find the chat input using proper data-testid
    const chatInput = page.locator('[data-testid="chat-input-textarea"]')
    
    // Test should fail if chat input is not found
    expect(await chatInput.isVisible({ timeout: 10000 })).toBe(true)

    // Type and send message
    const testMessage = "Hello test " + Date.now()
    await chatInput.fill(testMessage)
    await chatInput.press("Enter")

    // Wait longer for processing and AI response
    await page.waitForTimeout(10000)
    
    // Check for API errors after message sending (log but don't fail test)
    if (apiErrors.length > 0) {
      const criticalErrors = apiErrors.filter(error => 
        error.url.includes('/message') || error.url.includes('/session')
      )
      
      if (criticalErrors.length > 0) {
        const errorDetails = criticalErrors.map(e => `${e.method} ${e.url} (${e.status})`).join(', ')
        console.log(`API errors detected (non-blocking): ${errorDetails}`)
      }
    }

    // Check if our message appears anywhere on the page
    const pageText = await page.locator("body").textContent()
    console.log("Page text length:", pageText?.length)

    // Look for our test message
    if (pageText?.includes(testMessage)) {
      console.log("✅ User message found in UI")
    } else {
      console.log("❌ User message NOT found in UI")
    }

    // Check for message elements using proper data-testid
    const userMessages = await page.locator('[data-testid="message-user"]').count()
    const assistantMessages = await page.locator('[data-testid="message-assistant"]').count()
    console.log("Found", userMessages, "user messages and", assistantMessages, "assistant messages")

    // Verify user message appears using proper data-testid
    const userMessage = page.locator('[data-testid="message-user"]')
      .filter({ hasText: testMessage.substring(0, 10) })
    expect(await userMessage.isVisible({ timeout: 20000 })).toBe(true)
    
    console.log("✅ User message displayed correctly")
  })

  test("should verify messages are in the DOM", async ({ page }) => {
    console.log("Starting test: should verify messages are in the DOM")
    
    // Set up API error tracking
    const apiErrors: Array<{url: string, status: number, method: string}> = []
    
    // Monitor API responses for errors
    page.on("response", (response) => {
      if (response.url().includes("/session") || response.url().includes("/message")) {
        // Only log non-200 responses to reduce noise
        if (response.status() !== 200) {
          console.log(`🔍 SDK response: ${response.status()} ${response.url()}`)
        }
        
        if (response.status() >= 400) {
          const method = response.request().method()
          apiErrors.push({
            url: response.url(),
            status: response.status(),
            method: method
          })
          console.log(`❌ API Error: ${method} ${response.url()} returned ${response.status()}`)
        }
      }
    })

    const projectId2 = await openFirstProjectAndGetId(page)
    await goToChat(page, projectId2)

    // Get initial DOM state
    const initialHTML = await page.content()
    const initialLength = initialHTML.length
    console.log("Initial HTML length:", initialLength)

    // Send a message using proper data-testid
    const chatInput = page.locator('[data-testid="chat-input-textarea"]')
    
    // Test should fail if chat input is not found
    expect(await chatInput.isVisible({ timeout: 10000 })).toBe(true)
    
    await chatInput.fill("Test DOM message")
    await chatInput.press("Enter")

    // Wait longer for DOM changes and AI response
    await page.waitForTimeout(10000)
    
    // Check for API errors after message sending (log but don't fail test)
    if (apiErrors.length > 0) {
      const criticalErrors = apiErrors.filter(error => 
        error.url.includes('/message') || error.url.includes('/session')
      )
      
      if (criticalErrors.length > 0) {
        const errorDetails = criticalErrors.map(e => `${e.method} ${e.url} (${e.status})`).join(', ')
        console.log(`API errors detected (non-blocking): ${errorDetails}`)
      }
    }
    const finalHTML = await page.content()
    const finalLength = finalHTML.length
    console.log("Final HTML length:", finalLength)
    console.log("HTML growth:", finalLength - initialLength)

    // Look for any signs of messages in the DOM
    const hasUserRole = finalHTML.includes('role="user"') || finalHTML.includes('data-role="user"')
    const hasAssistantRole = finalHTML.includes('role="assistant"') || finalHTML.includes('data-role="assistant"')
    const hasMessageClass = finalHTML.includes('class="message') || finalHTML.includes("Message")

    console.log("Has user role:", hasUserRole)
    console.log("Has assistant role:", hasAssistantRole)
    console.log("Has message class:", hasMessageClass)

    // Verify at least one user message exists using proper data-testid
    const userMessages = page.locator('[data-testid="message-user"]')
    expect(await userMessages.count()).toBeGreaterThan(0)
    
    console.log("✅ DOM verification complete - messages found")
  })
})
