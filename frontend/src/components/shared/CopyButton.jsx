import { useState } from 'react'

export function CopyButton({ text, className = '' }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = (e) => {
    e.stopPropagation()
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <button
      className={`copy-btn ${copied ? 'copied' : ''} ${className}`}
      onClick={handleCopy}
      title="Copy to clipboard"
    >
      {copied ? '✓ copied' : 'copy'}
    </button>
  )
}
