import { useProfileStore } from '../../store/profileStore'
import { ScanCard } from '../shared/ScanCard'

export function SubdomainsCard() {
  const { results } = useProfileStore()
  const { status, subdomains } = results.networks
  const count = subdomains?.subdomains?.length || 0

  return (
    <ScanCard icon="🌿" title="SUBDOMAINS" status={count > 0 ? 'found' : status === 'scanning' ? 'scanning' : 'idle'} statusLabel={count > 0 ? `${count} found` : null}>
      {!subdomains ? (
        <div className="empty-state">{status === 'scanning' ? 'Enumerating via crt.sh…' : 'Run a scan (domain only)'}</div>
      ) : !subdomains.ok ? (
        <div className="empty-state" style={{ color: 'var(--accent-red)' }}>{subdomains.error}</div>
      ) : count === 0 ? (
        <div className="empty-state">No subdomains found in certificate transparency logs</div>
      ) : (
        <div style={{ maxHeight: 220, overflowY: 'auto' }}>
          {subdomains.subdomains.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0', borderBottom: '1px solid var(--border)', fontSize: 11 }}>
              <span className="found-dot" />
              <a href={`https://${s}`} target="_blank" rel="noopener noreferrer">{s}</a>
            </div>
          ))}
          {subdomains.total > 150 && (
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>Showing first 150 of {subdomains.total}</div>
          )}
        </div>
      )}
    </ScanCard>
  )
}
