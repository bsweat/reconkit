import { useProfileStore } from '../../store/profileStore'
import { ScanCard } from '../shared/ScanCard'

export function VirusTotalCard() {
  const { results, apiKeys } = useProfileStore()
  const { status, virustotal, target, target_type } = results.networks

  const malicious  = virustotal?.malicious || 0
  const suspicious = virustotal?.suspicious || 0
  const flagged    = malicious + suspicious

  return (
    <ScanCard icon="🛡" title="VIRUSTOTAL" status={flagged > 0 ? 'found' : virustotal?.found ? 'done' : status === 'scanning' ? 'scanning' : 'idle'} statusLabel={virustotal?.found ? `${malicious} malicious` : null}>
      {!apiKeys.virustotal ? (
        <div className="info-banner">ℹ Add a VirusTotal API key to enable</div>
      ) : !virustotal ? (
        <div className="empty-state">{status === 'scanning' ? 'Querying VirusTotal…' : 'Run a scan'}</div>
      ) : !virustotal.ok ? (
        <div className="empty-state" style={{ color: 'var(--accent-red)' }}>{virustotal.error}</div>
      ) : !virustotal.found ? (
        <div className="empty-state">No VirusTotal data found</div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
            {[
              { label: 'Malicious',  val: malicious,              color: malicious > 0 ? 'var(--accent-red)' : 'var(--text-muted)' },
              { label: 'Suspicious', val: suspicious,             color: suspicious > 0 ? 'var(--accent-orange)' : 'var(--text-muted)' },
              { label: 'Harmless',   val: virustotal.harmless,    color: 'var(--accent-green)' },
              { label: 'Undetected', val: virustotal.undetected,  color: 'var(--text-muted)' },
            ].map(({ label, val, color }) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color }}>{val ?? '?'}</div>
                <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
              </div>
            ))}
          </div>

          {virustotal.reputation != null && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
              Reputation score: <span style={{ color: virustotal.reputation < 0 ? 'var(--accent-red)' : 'var(--accent-green)' }}>{virustotal.reputation}</span>
            </div>
          )}

          {target && (
            <a href={`https://www.virustotal.com/gui/${target_type === 'ip' ? 'ip-address' : 'domain'}/${target}`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost" style={{ display: 'inline-flex', padding: '3px 10px' }}>
              View on VirusTotal ↗
            </a>
          )}
        </>
      )}
    </ScanCard>
  )
}
