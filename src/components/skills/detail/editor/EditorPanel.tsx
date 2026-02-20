interface EditorPanelProps {
  content: string
  onChange: (content: string) => void
  placeholder?: string
  className?: string
}

export function EditorPanel({ content, onChange, placeholder, className = '' }: EditorPanelProps) {
  return (
    <div className={className}>
      <textarea
        value={content}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-full p-6 bg-gray-900 text-gray-100 font-mono text-sm resize-none focus:outline-none"
        placeholder={placeholder}
        spellCheck={false}
      />
    </div>
  )
}
