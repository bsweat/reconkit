import { useProfileStore } from '../../store/profileStore'
import { ScanCard } from '../shared/ScanCard'

export function TechStackCard() {
  const { results } = useProfileStore()
  const { status, tech_stack } = results.networks
  const techs = tech_stack?.technologies || []

  return (
    <ScanCard icon="⚙" title="TECH STACK" status={techs.length > 0 ? 'found' : status === 'scanning' ? 'scanning' : 'idle'} statusLabel={techs.length > 0 ? `${techs.length} detected` : null}>
      {!tech_stack ? (
        <div className="empty-state">{status === 'scanning' ? 'Fingerprinting…' : 'Run a scan (domain only)'}</div>
      ) : !tech_stack.ok ? (
        <div className="empty-state" style={{ color: 'var(--accent-red)' }}>{tech_stack.error}</div>
      ) : (
        <>
          {tech_stack.server && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
              Server: <span style={{ color: 'var(--text-secondary)' }}>{tech_stack.server}</span>
              {tech_stack.powered_by && <span> · {tech_stack.powered_by}</span>}
            </div>
          )}
          {techs.length > 0 ? (
            <div>
              {techs.map(t => <span key={t} className="tech-pill">{t}</span>)}
            </div>
          ) : (
            <div className="empty-state">No technologies detected from headers/HTML</div>
          )}
        </>
      )}
    </ScanCard>
  )
}
