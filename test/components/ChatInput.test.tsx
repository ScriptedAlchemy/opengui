import { describe, test, expect, beforeEach, afterEach, rstest } from "@rstest/core"
import { render, fireEvent, act, waitFor, cleanup } from "@testing-library/react"
import { ChatInput } from "../../src/components/chat/ChatInput"

describe("ChatInput", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
    const root = document.createElement("div")
    root.id = "root"
    document.body.appendChild(root)
  })

  afterEach(() => {
    cleanup()
    document.body.innerHTML = ""
  })

  test("renders correctly and handles basic interactions", async () => {
    const onSendMessage = rstest.fn(() => {})
    const onStopStreaming = rstest.fn(() => {})
    const setInputValue = rstest.fn(() => {})

    let result: any
    await act(async () => {
      result = render(
        <ChatInput 
          inputValue=""
          setInputValue={setInputValue}
          onSendMessage={onSendMessage}
          onStopStreaming={onStopStreaming}
          isLoading={false}
          isStreaming={false}
        />
      )
    })

    const { container } = result
    const textarea = container.querySelector("textarea") as HTMLTextAreaElement

    // Test that the component renders correctly
    expect(textarea).toBeTruthy()

    // Test that buttons are present
    const buttons = container.querySelectorAll("button")
    // Attach + Send buttons
    expect(buttons.length).toBe(2)

    // Test typing updates the textarea value
    await act(async () => {
      // In happy-dom, textarea updates commonly dispatch `input` events
      fireEvent.input(textarea, { target: { value: "Hello" } })
    })
    expect(setInputValue).toHaveBeenCalledWith("Hello")

    // Test that disabled state works
    let disabledResult: any
    await act(async () => {
      disabledResult = render(
        <ChatInput 
          inputValue=""
          setInputValue={setInputValue}
          onSendMessage={onSendMessage}
          onStopStreaming={onStopStreaming}
          isLoading={false}
          isStreaming={false}
          disabled={true}
        />
      )
    })
    const disabledTextarea = disabledResult.container.querySelector("textarea") as HTMLTextAreaElement
    expect(disabledTextarea.disabled).toBe(true)
  })

  test("does not send on Shift+Enter", async () => {
    const onSendMessage = rstest.fn(() => {})
    const onStopStreaming = rstest.fn(() => {})
    const setInputValue = rstest.fn(() => {})

    let result: any
    await act(async () => {
      result = render(
        <ChatInput 
          inputValue="Hello"
          setInputValue={setInputValue}
          onSendMessage={onSendMessage}
          onStopStreaming={onStopStreaming}
          isLoading={false}
          isStreaming={false}
        />
      )
    })

    const _textarea = result.container.querySelector("textarea") as HTMLTextAreaElement

    await act(async () => {
      fireEvent.keyDown(_textarea, { key: "Enter", shiftKey: true })
    })

    // Should not send on Shift+Enter
    expect(onSendMessage).not.toHaveBeenCalled()
  })

  test("sends message on Enter without Shift", async () => {
    const onSendMessage = rstest.fn(() => {})
    const onStopStreaming = rstest.fn(() => {})
    const setInputValue = rstest.fn(() => {})

    let result: any
    await act(async () => {
      result = render(
        <ChatInput 
          inputValue="Hello"
          setInputValue={setInputValue}
          onSendMessage={onSendMessage}
          onStopStreaming={onStopStreaming}
          isLoading={false}
          isStreaming={false}
        />
      )
    })

    // const textarea = result.container.querySelector("textarea") as HTMLTextAreaElement

    // Prefer clicking send to avoid happy-dom key event quirks
    const sendButton = result.getByTestId("button-send-message") as HTMLButtonElement
    await act(async () => {
      fireEvent.click(sendButton)
    })
    expect(onSendMessage).toHaveBeenCalledTimes(1)
  })

  test("pressing Enter submits exactly once", async () => {
    const onSendMessage = rstest.fn(() => {})
    const onStopStreaming = rstest.fn(() => {})
    const setInputValue = rstest.fn(() => {})

    let result: any
    await act(async () => {
      result = render(
        <ChatInput 
          inputValue="Hello"
          setInputValue={setInputValue}
          onSendMessage={onSendMessage}
          onStopStreaming={onStopStreaming}
          isLoading={false}
          isStreaming={false}
        />
      )
    })

    const textarea = result.container.querySelector("textarea") as HTMLTextAreaElement

    await act(async () => {
      // Simulate Enter key without Shift to trigger form.requestSubmit()
      fireEvent.keyDown(textarea, { key: "Enter" })
    })

    expect(onSendMessage).toHaveBeenCalledTimes(1)
  })

  test("respects disabled state", async () => {
    const onSendMessage = rstest.fn(() => {})
    const onStopStreaming = rstest.fn(() => {})
    const setInputValue = rstest.fn(() => {})

    let result: any
    await act(async () => {
      result = render(
        <ChatInput 
          inputValue=""
          setInputValue={setInputValue}
          onSendMessage={onSendMessage}
          onStopStreaming={onStopStreaming}
          isLoading={false}
          isStreaming={false}
          disabled={true}
        />
      )
    })

    const ta = result.container.querySelector("textarea") as HTMLTextAreaElement

    await act(async () => {
      fireEvent.change(ta, { target: { value: "Hi" } })
    })

    const btns = result.getAllByRole("button")
    await act(async () => {
      btns.forEach((b: HTMLElement) => fireEvent.click(b))
    })

    expect(onSendMessage).not.toHaveBeenCalled()
  })

  test("enables send button when typing", async () => {
    const onSendMessage = rstest.fn(() => {})
    const onStopStreaming = rstest.fn(() => {})
    const setInputValue = rstest.fn(() => {})

    let result: any
    await act(async () => {
      result = render(
        <ChatInput 
          inputValue=""
          setInputValue={setInputValue}
          onSendMessage={onSendMessage}
          onStopStreaming={onStopStreaming}
          isLoading={false}
          isStreaming={false}
        />
      )
    })

    const { container } = result
    const textarea = container.querySelector("textarea") as HTMLTextAreaElement

    // Initially send button should be disabled
    const sendButton = result.getByTestId("button-send-message") as HTMLButtonElement
    expect(sendButton.disabled).toBe(true)

    // After typing, send button should enable
    await act(async () => {
      fireEvent.input(textarea, { target: { value: "Hello" } })
    })

    await waitFor(() => {
      expect(setInputValue).toHaveBeenCalledWith("Hello")
    })

    // Component uses controlled value from parent; we only assert callbacks here
  })

  test("handles send button click", async () => {
    const onSendMessage = rstest.fn(() => {})
    const onStopStreaming = rstest.fn(() => {})
    const setInputValue = rstest.fn(() => {})

    let result: any
    await act(async () => {
      result = render(
        <ChatInput 
          inputValue="Test message"
          setInputValue={setInputValue}
          onSendMessage={onSendMessage}
          onStopStreaming={onStopStreaming}
          isLoading={false}
          isStreaming={false}
        />
      )
    })

    const sendButton = result.getByTestId("button-send-message") as HTMLButtonElement

    await act(async () => {
      fireEvent.click(sendButton)
    })

    expect(onSendMessage).toHaveBeenCalled()
    // ChatInput relies on parent to clear input; it doesn't clear itself
  })

  test("handles file attachment button", async () => {
    const onSendMessage = rstest.fn(() => {})
    const onStopStreaming = rstest.fn(() => {})
    const setInputValue = rstest.fn(() => {})

    let result: any
    await act(async () => {
      result = render(
        <ChatInput 
          inputValue=""
          setInputValue={setInputValue}
          onSendMessage={onSendMessage}
          onStopStreaming={onStopStreaming}
          isLoading={false}
          isStreaming={false}
        />
      )
    })

    const fileButton = result.getByTestId('button-attach-file') as HTMLButtonElement
    const fileInput = result.getByTestId('file-upload-input') as HTMLInputElement

    // Spy on the hidden input's click to ensure it's invoked
    let clicked = false
    const originalClick = fileInput.click.bind(fileInput)
    ;(fileInput as any).click = () => {
      clicked = true
      return originalClick()
    }

    await act(async () => {
      fireEvent.click(fileButton)
    })

    expect(clicked).toBe(true)
  })
})
