"use client"
import { useRef } from "react"
import Editor, { OnMount } from "@monaco-editor/react"

export interface MonacoEditorProps {
  filePath: string
  content: string
  language: string
  onChange?: (value: string) => void
  onMount?: OnMount
  className?: string
}

export const MonacoEditor: React.FC<MonacoEditorProps> = ({
  filePath,
  content,
  language,
  onChange,
  onMount,
  className,
}) => {
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null)

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor
    onMount?.(editor, monaco)
  }

  return (
    <div className={`relative h-full w-full ${className || ""}`}>
      <Editor
        height="100%"
        theme="vs-dark"
        path={filePath}
        language={language}
        value={content}
        options={{
          fontSize: 14,
          minimap: { enabled: false },
          wordWrap: "on",
          scrollBeyondLastLine: false,
          automaticLayout: true,
          padding: { top: 8, bottom: 8 },
        }}
        onChange={(value) => onChange?.(value ?? "")}
        onMount={handleEditorDidMount}
      />
    </div>
  )
}

export default MonacoEditor
