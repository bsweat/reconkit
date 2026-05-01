import { useProfileStore } from '../../store/profileStore'
import { ScanCard } from '../shared/ScanCard'

export function ShodanCard() {
  const { results, apiKeys } = useProfileStore()
  const { status, shodan, target } = results.networks

  return (
    <ScanCard icon="📡" title="SHODAN" status={shodan?.found ? 'found' : status === 'scanning' ? 'scanning' : 'idle'}>
      {!apiKeys.shodan ? (
        <div className="info-banner">ℹ Add a Shodan API key to enable</div>
      ) : !shodan ? (
        <div className="empty-state">{status === 'scanning' ? 'Querying Shodan…' : 'Run a scan'}</div>
      ) : !shodan.ok ? (
        <div className="empty-state" style={{ color: 'var(--accent-red)' }}>{shodan.error}</div>
      ) : !shodan.found ? (
        <div className="empty-state">No Shodan data for this IP</div>
      ) : (
        <>
          <table className="data-table" style={{ marginBottom: 10 }}>
            <tbody>
              {shodan.org     && <tr><td>Org</td><td>{shodan.org}</td></tr>}
              {shodan.isp     && <tr><td>ISP</td><td>{shodan.isp}</td></tr>}
              {shodan.country && <tr><td>Country</td><td>{shodan.country}{shodan.city ? `, ${shodan.city}` : ''}</td></tr>}
              {shodan.os      && <tr><td>OS</td><td>{shodan.os}</td></tr>}
              {shodan.last_update && <tr><td>Last Seen</td><td>{shodan.last_update?.slice(0,10)}</td></tr>}
            </tbody>
          </table>

          {shodan.ports?.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>Open Ports</div>
              <div className="port-list">
                {shodan.ports.map(p => <span key={p} className="port-chip">{p}</span>)}
              </div>
            </div>
          )}

          {shodan.vulns?.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: 'var(--accent-red)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>
                ⚠ Vulnerabilities ({shodan.vulns.length})
              </div>
              <div className="port-list">
                {shodan.vulns.slice(0, 8).map(v => (
                  <a key={v} href={`https://nvd.nist.gov/vuln/detail/${v}`} target="_blank" rel="noopener noreferrer">
                    <span className="vuln-chip">{v}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          <a href={`https://www.shodan.io/host/${shodan.ip}`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost" style={{ display: 'inline-flex', padding: '3px 10px' }}>
            View on Shodan ↗
          </a>
        </>
      )}
    </ScanCard>
  )
}
