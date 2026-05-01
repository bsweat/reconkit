import { useState } from 'react'
import { useProfileStore } from '../../store/profileStore'
import { CopyButton } from '../shared/CopyButton'

function DorkItem({ dork }) {
  const query = dork.query
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`

  return (
    <div className="dork-item">
      <span className="dork-label" title={query}>{dork.label}</span>
      <div className="dork-actions">
        <CopyButton text={query} />
        <a href={searchUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 9 }}>
          open ↗
        </a>
      </div>
    </div>
  )
}

export function DorksCard() {
  const { results, profile } = useProfileStore()
  const { status, sections } = results.dorks
  const [open, setOpen] = useState(true)
  const [expandedSections, setExpandedSections] = useState({})

  const hasContent = sections?.length > 0
  const totalDorks = sections?.reduce((acc, s) => acc + s.dorks.length, 0) || 0

  const noAnchors = !profile.full_name && !profile.usernames.length && !profile.email

  const toggleSection = (title) =>
    setExpandedSections((prev) => ({ ...prev, [title]: !prev[title] }))

  if (noAnchors) {
    return (
      <div className="dorks-card">
        <div className="dorks-header" onClick={() => setOpen((v) => !v)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase' }}>◈ GOOGLE DORKS</span>
          </div>
          <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{open ? '▲' : '▼'}</span>
        </div>
        {open && (
          <div className="dorks-body">
            <div className="empty-state">Fill in profile fields to generate targeted dorks</div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="dorks-card">
      <div className="dorks-header" onClick={() => setOpen((v) => !v)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase' }}>◈ GOOGLE DORKS</span>
          {status === 'scanning' && <span className="spinner" />}
          {hasContent && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{totalDorks} queries</span>}
        </div>
        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div className="dorks-body">
          {!hasContent && status !== 'scanning' ? (
            <div className="empty-state">Run recon to generate dorks</div>
          ) : !hasContent && status === 'scanning' ? (
            <div className="empty-state">Generating dorks…</div>
          ) : (
            sections.map((section) => {
              const isExpanded = expandedSections[section.section] !== false  // default open
              return (
                <div key={section.section} className="dork-section">
                  <div
                    className="dork-section-title"
                    style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
                    onClick={() => toggleSection(section.section)}
                  >
                    <span>{section.section}</span>
                    <span style={{ color: 'var(--text-dim)' }}>
                      {section.dorks.length} dorks {isExpanded ? '▲' : '▼'}
                    </span>
                  </div>
                  {isExpanded && section.dorks.map((d, i) => (
                    <DorkItem key={i} dork={d} />
                  ))}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
