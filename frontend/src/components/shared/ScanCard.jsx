import { useState, useEffect } from 'react'

const STATUS_BADGES = {
  idle:     { label: 'IDLE',      cls: 'badge-idle' },
  scanning: { label: 'SCANNING',  cls: 'badge-scanning' },
  done:     { label: 'DONE',      cls: 'badge-done' },
  found:    { label: 'FOUND',     cls: 'badge-found' },
  error:    { label: 'ERROR',     cls: 'badge-error' },
  blocked:  { label: 'MANUAL',    cls: 'badge-blocked' },
}

export function ScanCard({ icon, title, status, statusLabel, children, defaultOpen = true, autoOpen = false, className = '' }) {
  const [open, setOpen] = useState(defaultOpen)

  // Auto-open when scan completes with results (for cards that start collapsed)
  useEffect(() => {
    if (autoOpen && (status === 'found' || status === 'done')) {
      setOpen(true)
    }
  }, [autoOpen, status])

  const badge = STATUS_BADGES[status] || STATUS_BADGES.idle
  const cardClass = `scan-card ${status === 'scanning' ? 'scanning' : ''} ${status === 'found' ? 'found' : ''} ${status === 'error' ? 'error' : ''} ${className}`

  return (
    <div className={cardClass}>
      <div className="scan-card-header" onClick={() => setOpen((v) => !v)}>
        <div className="scan-card-title">
          <span className="scan-card-icon">{icon}</span>
          <span>{title}</span>
          {status === 'scanning' && <span className="spinner" />}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className={`badge ${badge.cls}`}>{statusLabel || badge.label}</span>
          <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{open ? '▲' : '▼'}</span>
        </div>
      </div>
      {open && <div className="scan-card-body">{children}</div>}
    </div>
  )
}
