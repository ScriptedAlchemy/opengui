import React, { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  PromptInput, 
  PromptInputTextarea, 
  PromptInputToolbar, 
  PromptInputSubmit,
  PromptInputTools,
  PromptInputButton,
} from "@/components/ui/shadcn-io/ai/prompt-input"
import { Paperclip, X } from "lucide-react"
import { toast } from "sonner"
import { fileToAttachment, validateFile, formatFileSize, getFileIcon, type FileAttachment } from "@/util/file"

interface ChatInputProps {
  inputValue: string
  setInputValue: (value: string) => void
  onSendMessage: (attachments?: FileAttachment[]) => void
  onStopStreaming: () => void
  isLoading: boolean
  isStreaming: boolean
  disabled?: boolean
}

export const ChatInput: React.FC<ChatInputProps> = ({
  inputValue,
  setInputValue,
  onSendMessage,
  onStopStreaming,
  isLoading,
  isStreaming,
  disabled = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [attachments, setAttachments] = useState<FileAttachment[]>([])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const hasContent = !!inputValue.trim() || attachments.length > 0
    if (!isLoading && hasContent) {
      const toSend = attachments.length > 0 ? attachments : undefined
      if (isStreaming) {
        onStopStreaming()
        setTimeout(() => {
          onSendMessage(toSend)
        }, 0)
      } else {
        onSendMessage(toSend)
      }
      // Let the hook clear the input; only clear local attachments state
      setAttachments([])
    }
  }

  const handleAttachClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    const newAttachments: FileAttachment[] = []

    for (const file of files) {
      // Validate file
      const validation = validateFile(file, {
        maxSize: 10 * 1024 * 1024, // 10MB
        allowedTypes: [
          'image/*',
          'text/*',
          'application/pdf',
          'application/json',
          'application/javascript',
          'application/typescript',
          'application/octet-stream', // Fallback for unknown browser MIME detection
        ]
      })

      if (!validation.valid) {
        toast.error(`File "${file.name}": ${validation.error}`)
        continue
      }

      try {
        const attachment = await fileToAttachment(file)
        newAttachments.push(attachment)
      } catch (error) {
        toast.error(`Failed to process file "${file.name}"`)
        console.error('File processing error:', error)
      }
    }

    if (newAttachments.length > 0) {
      setAttachments(prev => [...prev, ...newAttachments])
      toast.success(`Added ${newAttachments.length} file(s)`)
    }

    // Reset the input to allow re-selecting the same file
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index))
  }

  return (
    <div className="border-t p-4" data-testid="chat-input">
      {/* File attachments preview */}
      {attachments.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {attachments.map((attachment, index) => (
            <Badge
              key={index}
              variant="secondary"
              className="flex items-center gap-2 px-3 py-1"
            >
              <span className="text-sm">{getFileIcon(attachment.mime)}</span>
              <span className="text-sm font-medium">{attachment.filename}</span>
              <span className="text-xs text-muted-foreground">
                {formatFileSize(attachment.size)}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                onClick={() => removeAttachment(index)}
                aria-label={`Remove attachment ${attachment.filename}`}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          ))}
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileChange}
        className="hidden"
        data-testid="file-upload-input"
        accept="image/*,text/*,.pdf,.json,.js,.ts,.tsx,.jsx,.md,.txt"
      />

      {/* Prompt input */}
      <PromptInput onSubmit={handleSubmit}>
        <PromptInputTextarea
          value={inputValue}
          onChange={(e) => setInputValue(e.currentTarget.value)}
          placeholder="Type your message..."
          disabled={disabled || isLoading}
          data-testid="chat-input-textarea"
        />
        <PromptInputToolbar>
          <PromptInputTools>
            <PromptInputButton
              onClick={handleAttachClick}
              disabled={disabled || isLoading}
              data-testid="button-attach-file"
              aria-label="Attach file"
              // Provide legacy test id used by some e2e specs
              data-test="file-upload-button"
            >
              <Paperclip size={16} />
            </PromptInputButton>
          </PromptInputTools>
          <PromptInputSubmit
            disabled={disabled || isLoading || (!inputValue.trim() && attachments.length === 0)}
            status={isStreaming ? 'streaming' : isLoading ? 'submitted' : 'ready'}
            data-testid="button-send-message"
          />
        </PromptInputToolbar>
      </PromptInput>
    </div>
  )
}
